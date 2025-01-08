export type OnesignalRequestBody = {
  app_id: string;
  android_channel_id: string;
  target_channel: string;
  small_icon: string;
  ios_badgeType: string;
  ios_badgeCount: number;
  data: unknown;
  headings: { en: string };
  subtitle: { en: string };
  contents: { en: string };
  include_external_user_ids?: string[];
  included_segments?: string[];
};

export class OnesignalClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendNotification(onesignalRequestBody: OnesignalRequestBody) {
    try {
      const response = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${this.apiKey}`,
        },
        body: JSON.stringify(onesignalRequestBody),
      });
      return response.json();
    } catch {
      return null;
    }
  }
}
