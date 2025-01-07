import { OnesignalClient } from "./onesignalClient.ts";

export class OnesignalService {
  private onesignalClient;
  private appId: string;
  private androidChannelId: string;

  constructor() {
    this.appId = Deno.env.get("ONESIGNAL_APP_ID") as string;
    this.androidChannelId = Deno.env.get(
      "ONESIGNAL_ANDROID_CHANNEL_ID",
    ) as string;
    this.onesignalClient = new OnesignalClient(
      Deno.env.get("ONESIGNAL_API_KEY") as string,
    );
  }

  async sendNotification(contents: {
    title: string;
    subtitle: string;
    message: string;
    data: unknown;
    userIds: string[];
  }) {
    const requestBody = {
      app_id: this.appId,
      android_channel_id: this.androidChannelId,
      target_channel: "push",
      small_icon: "ic_stat_onesignal_default",
      ios_badgeType: "Increase",
      ios_badgeCount: 1,
      data: contents.data,
      headings: { en: contents.title },
      subtitle: { en: contents.subtitle },
      contents: { en: contents.message },
      include_external_user_ids: contents.userIds,
    };
    const apiResponse = await this.onesignalClient.sendNotification(
      requestBody,
    );
    return apiResponse;
  }
}
