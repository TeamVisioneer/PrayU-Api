import { supabase } from "../client.ts";
import { kstDayStartISO } from "./kst.ts";

// 공유 보상 로그 접근 — kakao-webhook(쓰기)과 bible(한도 계산용 읽기)이 공유한다
export class ShareRewardRepository {
  async countToday(userId: string, feature: string): Promise<number> {
    const { count, error } = await supabase
      .from("share_reward_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("feature", feature)
      .gte("created_at", kstDayStartISO());

    if (error) {
      console.error("Error counting share reward:", error.code, error.message);
      throw error;
    }
    return count ?? 0;
  }

  async existsTodayInRoom(
    userId: string,
    hashChatId: string,
  ): Promise<boolean> {
    const { count, error } = await supabase
      .from("share_reward_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("hash_chat_id", hashChatId)
      .gte("created_at", kstDayStartISO());

    if (error) {
      console.error("Error checking share reward room:", error.code, error.message);
      throw error;
    }
    return (count ?? 0) > 0;
  }

  async insert(
    userId: string,
    feature: string,
    chatType: string | null,
    hashChatId: string | null,
  ): Promise<void> {
    const { error } = await supabase
      .from("share_reward_log")
      .insert({
        user_id: userId,
        feature,
        chat_type: chatType,
        hash_chat_id: hashChatId,
      });

    if (error) {
      console.error("Error inserting share reward:", error.code, error.message);
      throw error;
    }
  }
}
