import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { AdminRepository } from "./adminRepository.ts";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AdminController {
  private adminRepository: AdminRepository;

  constructor() {
    this.adminRepository = new AdminRepository();
  }

  /**
   * 대상 사용자의 프리미엄 만료일 설정/해제.
   *
   * 클라이언트의 profiles.premium_expired_at 직접 UPDATE 는 컬럼 권한으로 막혀 있다
   * (revoke_premium_update 마이그레이션) — 이 경로가 유일한 쓰기 지점이다.
   * 함수는 service role 클라이언트라 **여기의 is_admin 검사가 권한의 전부**다.
   */
  async setPremiumExpiryV1(c: Context) {
    const callerId = c.get("userId");
    // 로그인 사용자만 — 인프라 호출자(service_role)가 쓸 일이 없다
    if (!callerId || callerId === "anon" || callerId === "service_role") {
      return json({ data: null, error: "Unauthorized" }, 401);
    }
    if (!(await this.adminRepository.isAdmin(callerId))) {
      return json({ data: null, error: "Forbidden" }, 403);
    }

    let body: { userId?: string; premiumExpiredAt?: string | null };
    try {
      body = await c.req.json();
    } catch {
      return json({ data: null, error: "Invalid body" }, 400);
    }

    const { userId, premiumExpiredAt } = body;
    if (!userId || !UUID_RE.test(userId)) {
      return json({ data: null, error: "userId must be a uuid" }, 400);
    }
    // null 은 해제. 문자열이면 파싱 가능한 일시여야 한다
    if (
      premiumExpiredAt !== null &&
      (typeof premiumExpiredAt !== "string" ||
        Number.isNaN(Date.parse(premiumExpiredAt)))
    ) {
      return json(
        { data: null, error: "premiumExpiredAt must be an ISO datetime or null" },
        400,
      );
    }

    try {
      const found = await this.adminRepository.setPremiumExpiry(
        userId,
        premiumExpiredAt,
      );
      if (!found) return json({ data: null, error: "User not found" }, 404);
      return json({ data: { userId, premiumExpiredAt }, error: null }, 200);
    } catch (error) {
      console.error("Failed to set premium expiry:", error);
      return json({ data: null, error: "Failed to set premium expiry" }, 500);
    }
  }
}
