import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { AuthHandoffController } from "./authHandoffController.ts";

// 카카오 원탭 로그인 — 세션 핸드오프 우체통 (docs: PrayU-web/docs/plans/kakao-login-handoff.md)
// authMiddleware 미사용 — claim 은 "아직 로그인 안 된 원래 탭"이 호출하므로 JWT 가 없다
// (config.toml verify_jwt=false 필수). anon 허용은 의도된 결정:
//   - deposit: 유효한 access_token 을 가진 자만 성공 (서버에서 auth.getUser 로 검증)
//   - claim:   secret(256bit) 보유자만 성공 — nonce 는 secret 의 SHA-256 커밋이라 URL 노출이 무해
//   - resolve: 누구나 할 수 있는 authorize GET 을 서버가 대신 하는 것뿐 (비밀 없음)
const app = new Hono();
const controller = new AuthHandoffController();

app.options("*", (c) => c.body(null, 204, corsHeaders));
app.post("/auth-handoff/deposit", (c) => controller.deposit(c));
app.post("/auth-handoff/claim", (c) => controller.claim(c));
app.post("/auth-handoff/resolve", (c) => controller.resolve(c));

Deno.serve(app.fetch);
