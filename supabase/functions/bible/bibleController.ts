import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { BibleService } from "./bibleService.ts";
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
    const { query } = await c.req.json();
    const bibleResponse = await this.bibleService.searchBible(query);
    if (!bibleResponse) {
      return this.createResponse({
        data: null,
        error: "Failed to get bible response",
      }, 500);
    }
    return this.createResponse({ data: bibleResponse }, 200);
  }
}
