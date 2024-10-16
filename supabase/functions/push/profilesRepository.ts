import { supabase } from "../client.ts";

export class ProfilesRepository {
  async getFCMTokenByUserId(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("fcm_token, push_notification")
        .eq("user_id", userId)
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
}
