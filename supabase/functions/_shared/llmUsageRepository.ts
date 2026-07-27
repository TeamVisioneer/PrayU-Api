import { supabase } from "../client.ts";
import { AIUsage } from "./ai/aiClient.ts";
import { Json } from "../_types/database.ts";
import { kstDayStartISO } from "./kst.ts";

export class LlmUsageRepository {
  async countToday(userId: string, feature: string): Promise<number> {
    const { count, error } = await supabase
      .from("llm_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("feature", feature)
      .gte("created_at", kstDayStartISO());

    if (error) {
      console.error("Error counting llm usage:", error.code, error.message);
      throw error;
    }
    return count ?? 0;
  }

  async insert(
    userId: string,
    feature: string,
    metadata: Json,
  ): Promise<string> {
    const { data, error } = await supabase
      .from("llm_usage_log")
      .insert({ user_id: userId, feature, metadata })
      .select("id")
      .single();

    if (error) {
      console.error("Error inserting llm usage:", error.code, error.message);
      throw error;
    }
    return data.id;
  }

  async updateUsage(id: string, usage: AIUsage): Promise<void> {
    const { error } = await supabase
      .from("llm_usage_log")
      .update({
        model: usage.model,
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating llm usage:", error.code, error.message);
      throw error;
    }
  }
}
