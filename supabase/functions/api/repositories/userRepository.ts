import { supabase } from "../../client.ts";

export class UserRepository {
  async getFCMTokensByUserID(userID: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("fcm_token")
      .eq("id", userID);

    if (error) {
      // sentry
      console.error("Error fetching FCM tokens:", error.message);
      return [];
    }
    return data.map((token: { fcm_token: string }) => token.fcm_token);
  }

  async addFCMToken(userID: string, fcmToken: string): Promise<boolean> {
    const { error } = await supabase
      .from("profiles")
      .select("*")
      .eq("fcm_token", fcmToken)
      .single();

    if (error) {
      console.error("Error selecting FCM token:", error.message);
      return false;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ fcm_token: fcmToken })
      .eq("id", userID);
    if (updateError) {
      console.error("Error inserting FCM token:", updateError.message);
      return false;
    }
    return true;
  }

  async deleteFCMToken(userID: string, fcmToken: string): Promise<boolean> {
    const { error } = await supabase
      .from("profiles")
      .update({ fcm_token: "" })
      .eq("user_id", userID)
      .eq("fcm_token", fcmToken);

    if (error) {
      console.error("Error deleting FCM token:", error.message);
      return false;
    }
    return true;
  }
}
