import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { supabase } from "../client.ts";
import { corsHeaders } from "../_shared/cors.ts";

// 세션 핸드오프 우체통 (docs: PrayU-web/docs/plans/kakao-login-handoff.md)
//
// deposit: 카카오톡 인앱브라우저(로그인 완결 컨텍스트)가 세션 토큰을 nonce 로 예치
// claim:   원래 탭이 secret 을 제시해 토큰 수령 — nonce = SHA-256(secret) 커밋 검증
// resolve: 안드로이드 원탭용 — GoTrue authorize 의 302 Location(kauth URL)에서 state 등을
//          꺼내 준다 (docs: PrayU-web/docs/archive/kakao-android-onetap.md)
//
// 보안 불변식 (전부 이 파일이 강제한다):
// - deposit 은 access_token 을 auth.getUser() 로 서버 검증한 뒤에만 저장 (위조 토큰 예치 차단)
// - nonce 당 deposit 1회 (중복 409) · claim 즉시 행 삭제 (1회용) · TTL 3분
// - nonce/secret/토큰을 로그·에러 메시지에 절대 싣지 않는다

const TTL_MS = 3 * 60 * 1000;
const HEX64 = /^[0-9a-f]{64}$/;
const KAUTH_HOST = "kauth.kakao.com";

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

  /**
   * 안드로이드 카카오 원탭: 카카오톡 로그인 액티비티 intent 에 실을 authorize 파라미터를 돌려준다.
   * 브라우저 JS 는 authorize 302 의 Location 을 볼 수 없어(불투명 리다이렉트) 서버가 대신 읽는다.
   *
   * 클라이언트가 URL 을 주지 않는다 — redirect_to 만 받고 authorize URL 은 여기서 SUPABASE_URL 로
   * 조립한다(임의 URL fetch 불가). redirect_to 의 허용 여부는 GoTrue 가 판단한다(미허용이면 Site URL).
   * state 는 어차피 kauth URL 에 노출되는 값이라 새 노출이 없다.
   */
  async resolve(c: Context) {
    let body: { redirect_to?: string };
    try {
      body = await c.req.json();
    } catch {
      return json(c, 400, { error: "invalid body" });
    }
    const { redirect_to } = body;
    if (
      typeof redirect_to !== "string" || redirect_to.length === 0 ||
      redirect_to.length > 2048 || !/^https?:\/\//.test(redirect_to)
    ) {
      return json(c, 400, { error: "invalid params" });
    }

    const authorizeUrl = new URL(
      "/auth/v1/authorize",
      Deno.env.get("SUPABASE_URL")!,
    );
    authorizeUrl.searchParams.set("provider", "kakao");
    authorizeUrl.searchParams.set("redirect_to", redirect_to);

    let location: string | null;
    try {
      const res = await fetch(authorizeUrl, {
        redirect: "manual",
        headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
      });
      location = res.status >= 300 && res.status < 400
        ? res.headers.get("location")
        : null;
    } catch {
      location = null;
    }
    if (!location) {
      console.error("auth-handoff resolve: authorize did not redirect");
      return json(c, 502, { error: "authorize failed" });
    }

    let kauth: URL;
    try {
      kauth = new URL(location);
    } catch {
      return json(c, 502, { error: "authorize failed" });
    }
    const p = kauth.searchParams;
    const client_id = p.get("client_id");
    const redirect_uri = p.get("redirect_uri");
    const state = p.get("state");
    if (
      kauth.hostname !== KAUTH_HOST || !client_id || !redirect_uri || !state
    ) {
      console.error("auth-handoff resolve: unexpected authorize location host");
      return json(c, 502, { error: "authorize failed" });
    }
    return json(c, 200, {
      client_id,
      redirect_uri,
      state,
      scope: p.get("scope") ?? undefined,
    });
  }
}
