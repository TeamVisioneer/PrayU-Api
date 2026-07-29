import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { presignPutUrl } from "./uploadService.ts";

/** 올릴 수 있는 용도. 경로를 클라이언트가 정하지 못하게 이 목록으로 제한한다 */
const KINDS = ["bible_card", "thanks_card", "notice"] as const;
type Kind = (typeof KINDS)[number];

/** 허용 타입 → 확장자. 목록에 없으면 거부한다 */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export class UploadController {
  /**
   * 사전 서명 PUT URL 을 발급한다.
   *
   * 브라우저는 이 URL 로 파일 본문만 올리고, DB 에는 함께 받은 `key` 를 저장한다.
   * 공개 주소는 앱이 환경변수와 조합해 만든다 — 스토리지 도메인이 DB 에 박히지 않게.
   */
  async createUploadUrlV1(c: Context) {
    const userId = c.get("userId");
    // 업로드는 로그인 사용자만. 인프라 호출자도 쓸 일이 없다
    if (!userId || userId === "anon" || userId === "service_role") {
      return json({ data: null, error: "Unauthorized" }, 401);
    }

    let body: { kind?: string; contentType?: string };
    try {
      body = await c.req.json();
    } catch {
      return json({ data: null, error: "Invalid body" }, 400);
    }

    const { kind, contentType } = body;
    if (!kind || !KINDS.includes(kind as Kind)) {
      return json(
        { data: null, error: `kind must be one of ${KINDS.join(", ")}` },
        400,
      );
    }
    const extension = contentType ? EXTENSIONS[contentType] : undefined;
    if (!extension) {
      return json(
        {
          data: null,
          error: `contentType must be one of ${Object.keys(EXTENSIONS).join(", ")}`,
        },
        400,
      );
    }

    const endpoint = Deno.env.get("R2_ENDPOINT");
    const bucket = Deno.env.get("R2_BUCKET");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      console.error("R2 secrets are not configured");
      return json({ data: null, error: "Storage is not configured" }, 500);
    }

    // 키는 **서버가** 만든다. 클라이언트가 경로를 정하면 남의 파일을 덮어쓸 수 있다
    const key = `${kind}/${crypto.randomUUID()}.${extension}`;

    try {
      const url = await presignPutUrl({
        endpoint,
        bucket,
        key,
        accessKeyId,
        secretAccessKey,
        contentType,
      });
      return json({ data: { url, key }, error: null }, 200);
    } catch (error) {
      console.error("Failed to presign upload url:", error);
      return json({ data: null, error: "Failed to create upload url" }, 500);
    }
  }
}
