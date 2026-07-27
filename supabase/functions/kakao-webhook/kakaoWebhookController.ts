import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { ShareRewardService } from "./shareRewardService.ts";

export class KakaoWebhookController {
  private shareRewardService: ShareRewardService;

  constructor() {
    this.shareRewardService = new ShareRewardService();
  }

  private json(data: unknown, status: number) {
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status,
    });
  }

  async handle(c: Context) {
    // 카카오 서버 진위 확인 — 대표 어드민 키 대조 (이 함수의 유일한 인증)
    const adminKey = Deno.env.get("KAKAO_ADMIN_KEY") ?? "";
    if (!adminKey || c.req.header("Authorization") !== `KakaoAK ${adminKey}`) {
      console.error("kakao-webhook: invalid KakaoAK authorization");
      return this.json({ error: "Unauthorized" }, 401);
    }

    // GET(쿼리) / POST(JSON) 양쪽 지원 (카카오 웹훅 스펙)
    let params: Record<string, unknown> = {};
    if (c.req.method === "GET") {
      params = c.req.query();
    } else {
      params = await c.req.json().catch(() => ({}));
    }

    console.log(
      "kakao-webhook received:",
      JSON.stringify({
        resourceId: c.req.header("X-Kakao-Resource-ID"),
        chatType: params["CHAT_TYPE"],
        feature: params["feature"],
      }),
    );

    // 3초 내 2XX 응답 요건 — 지급 실패도 200으로 응답하고 사유는 로그로 남긴다
    // (카카오 재시도 유발 방지: 규칙상 미지급은 우리 쪽 정상 처리)
    try {
      const result = await this.shareRewardService.grantReward({
        userId: String(params["user_id"] ?? ""),
        feature: String(params["feature"] ?? ""),
        chatType: params["CHAT_TYPE"] ? String(params["CHAT_TYPE"]) : null,
        hashChatId: params["HASH_CHAT_ID"] ? String(params["HASH_CHAT_ID"]) : null,
      });
      if (!result.granted) {
        console.log("kakao-webhook: reward not granted -", result.reason);
      }
      return this.json({ granted: result.granted }, 200);
    } catch (error) {
      console.error("kakao-webhook: grant failed -", error);
      return this.json({ granted: false }, 200);
    }
  }
}
