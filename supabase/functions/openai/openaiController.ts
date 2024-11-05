import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { BibleCardService } from "./BibleCardService.ts";

export class OpenaiController {
  private bibleCardService;

  constructor() {
    this.bibleCardService = new BibleCardService();
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

  async getBibleMessage(c: Context) {
    const { content } = await c.req.json();
    const result = await this.bibleCardService.getBibleMessage(content);
    if (!result) {
      return this.createResponse({
        data: null,
        error: "Failed to get bible message",
      }, 500);
    }
    return this.createResponse(result, 200);
  }

  async getNatureImage(c: Context) {
    const { content } = await c.req.json();
    const result = await this.bibleCardService.getNatureImage(content);
    if (!result) {
      return this.createResponse({
        data: null,
        error: "Failed to get nature image",
      }, 500);
    }
    return this.createResponse({ data: result }, 200);
  }
}
