import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { BibleService, DailyLimitExceededError } from "./bibleService.ts";
import { corsHeaders } from "../_shared/cors.ts";

export class BibleController {
  private bibleService: BibleService;

  constructor() {
    this.bibleService = new BibleService();
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

  async searchBible(c: Context) {
    // 개인별 쿼터가 걸린 엔드포인트 — anon 토큰은 사용자 식별이 안 되므로 거부
    const userId = c.get("userId");
    if (!userId || userId === "anon") {
      return this.createResponse({ data: null, error: "LOGIN_REQUIRED" }, 401);
    }

    const { query, prayCardId } = await c.req.json();
    try {
      const bibleResponse = await this.bibleService.searchBible(
        userId,
        query,
        prayCardId,
      );
      if (!bibleResponse) {
        return this.createResponse({
          data: null,
          error: "Failed to get bible response",
        }, 500);
      }
      return this.createResponse({ data: bibleResponse }, 200);
    } catch (error) {
      if (error instanceof DailyLimitExceededError) {
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
