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

export type OnesignalUpdateUserRequestBody = {
  properties?: {
    tags?: { [key: string]: string };
    language?: string;
    timezone_id?: string;
    lat?: number;
    long?: number;
    country?: string;
    first_active?: number;
    last_active?: number;
  };
  deltas?: {
    session_count?: number;
    purchases?: { sku: string; iso: string; amount: string; count: number }[];
    session_time?: number;
  };
};

export class OnesignalClient {
  private apiKey: string;
  private appId: string;
  constructor(apiKey: string, appId: string) {
    this.apiKey = apiKey;
    this.appId = appId;
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

  async updateUser(
    userId: string,
    onesignalUpdateUserRequestBody: OnesignalUpdateUserRequestBody,
  ) {
    try {
      const response = await fetch(
        `https://api.onesignal.com/apps/${this.appId}/users/by/external_id/${userId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Key ${this.apiKey}`,
          },
          body: JSON.stringify(onesignalUpdateUserRequestBody),
        },
      );
      return response.json();
    } catch {
      return null;
    }
  }
}
