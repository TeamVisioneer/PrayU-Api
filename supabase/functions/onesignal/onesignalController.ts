import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { OnesignalService } from "./onesignalService.ts";

export class OnesignalController {
  private onesignalService;

  constructor() {
    this.onesignalService = new OnesignalService();
  }

  private createResponse(result: { data: unknown; errors: unknown } | null) {
    if (!result) {
      return new Response(
        JSON.stringify({
          data: null,
          error: { message: "Failed to send notification" },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }
    if (result.errors) {
      return new Response(
        JSON.stringify({
          data: null,
          error: { message: result.errors },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }

  async sendNotification(c: Context) {
    const requestBody = await c.req.json();
    const result = await this.onesignalService.sendNotification(
      requestBody,
    );
    return this.createResponse(result);
  }

  async sendReminderNotification(c: Context) {
    const { reminderTime, reminderType } = await c.req.json();
    const userId = c.get("userId");
    if (userId !== "service_role") {
      return new Response(
        JSON.stringify({
          data: null,
          error: "Unauthorized",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    const currentTime = new Date();
    const currentTimeString = currentTime.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Seoul",
    });

    if (reminderType === "prayTime") {
      const prayTime = reminderTime || currentTimeString;
      const prayTimeHour = prayTime.split(":")[0] + ":00";
      const result = await this.onesignalService
        .sendPrayTimeReminderNotification(
          { prayTime: prayTimeHour },
        );
      return this.createResponse(result);
    } else {
      return new Response(
        JSON.stringify({
          data: null,
          error: "Invalid reminder type",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }
  }

  async updateUser(c: Context) {
    const requestBody = await c.req.json();
    const userId = c.get("userId");
    const result = await this.onesignalService.updateUser({
      userId,
      body: requestBody,
    });
    return this.createResponse(result);
  }
}
