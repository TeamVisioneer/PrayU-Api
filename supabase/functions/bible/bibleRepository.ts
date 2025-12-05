import { supabase } from "../client.ts";

export class BibleRepository {
  constructor() {}

  async getBible(
    longLabel: string,
    chapter: number,
    paragraph: number,
  ) {
    const { data, error } = await supabase
      .from("bible")
      .select("*")
      .eq("long_label", longLabel)
      .eq("chapter", chapter)
      .eq("paragraph", paragraph)
      .single();

    if (error) {
      console.error(
        "Error searching bible:",
        error.code,
        error.message,
        error.details,
      );
      return null;
    }
    return data;
  }
}
