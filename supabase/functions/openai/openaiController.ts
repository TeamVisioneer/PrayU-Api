import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { QuietTimeService } from "./QuietTimeService.ts";

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
    const { content } = await c.req.json();
    const result = await this.quietTimeService.getQTcontent(content);
    if (!result) {
      return this.createResponse({
        data: null,
        error: "Failed to get bible message",
      }, 500);
    }
    return this.createResponse(result, 200);
  }
}
