import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { OnesignalService } from "./onesignalService.ts";

export class OnesignalController {
  private onesignalService;

  constructor() {
    this.onesignalService = new OnesignalService();
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

  async sendNotification(c: Context) {
    const contents = await c.req.json();
    const result = await this.onesignalService.sendNotification(contents);
    if (!result) {
      return this.createResponse({
        data: null,
        error: { message: "Failed to send notification" },
      }, 500);
    }
    if (result.errors) {
      return this.createResponse({
        data: null,
        error: { message: JSON.stringify(result.errors) },
      }, 500);
    }
    return this.createResponse(result, 200);
  }
}
