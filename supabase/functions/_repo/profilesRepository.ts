import { supabase } from "../client.ts";

export class ProfilesRepository {
  async getFCMTokenByUserId(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("fcm_token, push_notification")
        .eq("id", userId)
        .single();
      if (error) {
        console.error("Error get User Profile:", error.message);
        return null;
      }
      return data;
    } catch (error) {
      console.error("Error get User Profile:", error.message);
      return null;
    }
  }

  async fetchFCMToken(startId: string, limit: number = 500) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, fcm_token, push_notification")
        .eq("push_notification", true)
        .not("fcm_token", "eq", "")
        .gt("id", startId)
        .order("id", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching FCM tokens:", error.message);
        return [];
      }
      return data;
    } catch (error) {
      console.error("Error fetching FCM tokens:", error.message);
      return [];
    }
  }
}
