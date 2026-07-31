import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { KakaoWebhookController } from "./kakaoWebhookController.ts";

// 카카오톡 공유 웹훅 수신 함수 (docs: PrayU-web/docs/archive/share-reward-plan.md)
// authMiddleware 미사용 — 호출 주체가 카카오 서버라 JWT가 없고,
// 컨트롤러의 KakaoAK 어드민 키 대조가 유일한 인증이다 (config.toml verify_jwt=false 필수)
const app = new Hono();
const controller = new KakaoWebhookController();

app.get("/kakao-webhook", (c) => controller.handle(c));
app.post("/kakao-webhook", (c) => controller.handle(c));

Deno.serve(app.fetch);
