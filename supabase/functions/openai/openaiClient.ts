import OpenAI from "npm:openai";

export class OpenaiClient {
  private openai;

  constructor() {
    this.openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_SECRET_KEY") });
  }

  async generateText(prompt: string) {
    try {
      const result = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { "type": "json_object" },
        messages: [{ role: "user", content: prompt }],
      });
      return result;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}
