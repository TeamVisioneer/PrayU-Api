import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  QtDailyLimitExceededError,
  QuietTimeService,
} from "./QuietTimeService.ts";

export class OpenaiController {
  private quietTimeService;

  constructor() {
    this.quietTimeService = new QuietTimeService();
  }
  private createResponse(data: unknown, status: number) {
    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: status,
      },
    );
  }

  async getQTcontent(c: Context) {
    // 개인별 쿼터가 걸린 엔드포인트 — anon 토큰은 사용자 식별이 안 되므로 거부
    const userId = c.get("userId");
    if (!userId || userId === "anon") {
      return this.createResponse({ data: null, error: "LOGIN_REQUIRED" }, 401);
    }

    const { content } = await c.req.json();
    try {
      const result = await this.quietTimeService.getQTcontent(userId, content);
      if (!result) {
        return this.createResponse({
          data: null,
          error: "Failed to get bible message",
        }, 500);
      }
      // 성공 응답은 QT JSON을 그대로 반환 (기존 웹 파싱 호환)
      return this.createResponse(result, 200);
    } catch (error) {
      if (error instanceof QtDailyLimitExceededError) {
        return this.createResponse({
          data: null,
          error: "DAILY_LIMIT_EXCEEDED",
          limit: error.limit,
          used: error.used,
        }, 429);
      }
      throw error;
    }
  }
}
