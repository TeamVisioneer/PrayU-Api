import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { supabase } from "../client.ts";
import { corsHeaders } from "../_shared/cors.ts";

// 세션 핸드오프 우체통 (docs: PrayU-web/docs/plans/kakao-login-handoff.md)
//
// deposit: 카카오톡 인앱브라우저(로그인 완결 컨텍스트)가 세션 토큰을 nonce 로 예치
// claim:   원래 탭이 secret 을 제시해 토큰 수령 — nonce = SHA-256(secret) 커밋 검증
//
// 보안 불변식 (전부 이 파일이 강제한다):
// - deposit 은 access_token 을 auth.getUser() 로 서버 검증한 뒤에만 저장 (위조 토큰 예치 차단)
// - nonce 당 deposit 1회 (중복 409) · claim 즉시 행 삭제 (1회용) · TTL 3분
// - nonce/secret/토큰을 로그·에러 메시지에 절대 싣지 않는다

const TTL_MS = 3 * 60 * 1000;
const HEX64 = /^[0-9a-f]{64}$/;

const json = (c: Context, status: number, body: Record<string, unknown>) =>
  c.json(body, status as 200, corsHeaders);

const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// 만료 예치분 lazy 정리 — 별도 cron 없이 호출 시마다 청소
const deleteExpired = async () => {
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  await supabase.from("auth_handoff").delete().lt("created_at", cutoff);
};

export class AuthHandoffController {
  async deposit(c: Context) {
    let body: { nonce?: string; access_token?: string; refresh_token?: string };
    try {
      body = await c.req.json();
    } catch {
      return json(c, 400, { error: "invalid body" });
    }
    const { nonce, access_token, refresh_token } = body;
    if (
      typeof nonce !== "string" || !HEX64.test(nonce) ||
      typeof access_token !== "string" || access_token.length === 0 ||
      access_token.length > 4096 ||
      typeof refresh_token !== "string" || refresh_token.length === 0 ||
      refresh_token.length > 1024
    ) {
      return json(c, 400, { error: "invalid params" });
    }

    // 이 프로젝트의 유효한 세션 토큰인지 서버에서 검증 — 통과해야만 예치
    const { data: userData, error: userError } = await supabase.auth.getUser(
      access_token,
    );
    if (userError || !userData?.user) {
      return json(c, 401, { error: "invalid session token" });
    }

    await deleteExpired();

    const { error } = await supabase
      .from("auth_handoff")
      .insert({ nonce, access_token, refresh_token });
    if (error) {
      // 23505 = unique violation → 같은 nonce 재예치 시도
      if (error.code === "23505") return json(c, 409, { error: "duplicate" });
      console.error("auth-handoff deposit insert failed:", error.code); // 토큰/논스 미기록
      return json(c, 500, { error: "deposit failed" });
    }
    return json(c, 200, { ok: true });
  }

  async claim(c: Context) {
    let body: { secret?: string };
    try {
      body = await c.req.json();
    } catch {
      return json(c, 400, { error: "invalid body" });
    }
    const { secret } = body;
    if (typeof secret !== "string" || !HEX64.test(secret)) {
      return json(c, 400, { error: "invalid params" });
    }

    await deleteExpired();

    // 커밋 검증: 제시된 secret 의 해시가 곧 nonce
    const nonce = await sha256Hex(secret);

    // delete ... returning 으로 조회+삭제를 원자화 — 동시 claim 경합 시 한쪽만 수령
    const { data, error } = await supabase
      .from("auth_handoff")
      .delete()
      .eq("nonce", nonce)
      .select("access_token, refresh_token");
    if (error) {
      console.error("auth-handoff claim delete failed:", error.code);
      return json(c, 500, { error: "claim failed" });
    }
    if (!data || data.length === 0) {
      // 아직 예치 전(폴링 중) 또는 만료/수령 완료 — 구분 없이 404 (정보 노출 최소화)
      return json(c, 404, { error: "not found" });
    }
    const row = data[0];
    return json(c, 200, {
      access_token: row.access_token,
      refresh_token: row.refresh_token,
    });
  }
}
