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
        messages: [{ role: "user", content: prompt }],
      });
      return result;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async generateImage(prompt: string) {
    try {
      const response = await this.openai.images.generate({
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        model: "dall-e-3",
        response_format: "url",
      });
      return response;
    } catch (error) {
      console.error("Error generating image:", error);
      return null;
    }
  }
}
