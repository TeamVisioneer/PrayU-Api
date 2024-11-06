import { supabase } from "../client.ts";

export class BibleRepository {
  async searchBible(embedding: string) {
    const { data, error } = await supabase.rpc("search_bible", {
      embedding_content: embedding,
    });

    if (error) {
      console.error("Error searching bible:", error.message);
      return null;
    }
    return data;
  }
}
