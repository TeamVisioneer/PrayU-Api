import { supabase } from "../../client.ts";

export class UserRepository {
  async getFCMTokensByUserID(userID: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("fcm_tokens")
      .select("fcm_token")
      .eq("user_id", userID);

    if (error) {
      // sentry
      console.error("Error fetching FCM tokens:", error.message);
      return [];
    }
    return data.map((token: { fcm_token: string }) => token.fcm_token);
  }

  async addFCMToken(userID: string, fcmToken: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("fcm_tokens")
      .select("*")
      .eq("fcm_token", fcmToken)
      .single();

    if (error && error.code !== "PGRST116") { // 'PGRST116'은 no rows 에러 코드
      console.error("Error selecting FCM token:", error.message);
      return false;
    }

    if (data) {
      const { error } = await supabase
        .from("fcm_tokens")
        .update({ user_id: userID })
        .eq("fcm_token", fcmToken);
      if (error) {
        console.error("Error updating FCM token:", error.message);
        return false;
      }
      return true;
    } else {
      const { error } = await supabase
        .from("fcm_tokens")
        .insert([{ user_id: userID, fcm_token: fcmToken }]);

      if (error) {
        console.error("Error inserting FCM token:", error.message);
        return false;
      }

      return true;
    }
  }

  async deleteFCMToken(userID: string, fcmToken: string): Promise<boolean> {
    const { error } = await supabase
      .from("fcm_tokens")
      .delete()
      .eq("user_id", userID)
      .eq("fcm_token", fcmToken);

    if (error) {
      console.error("Error deleting FCM token:", error.message);
      return false;
    }
    return true;
  }
}
