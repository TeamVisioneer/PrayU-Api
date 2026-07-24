import type { AIChatResult, AIClient } from "./aiClient.ts";
import OpenAI from "npm:openai";

export class OpenaiClient implements AIClient {
  private apiKey: string;
  private model: string = "gpt-4o-mini";
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    if (!this.apiKey) {
      throw new Error("OPENAI_SECRET_KEY is not set");
    }
    this.openai = new OpenAI({ apiKey: this.apiKey });
  }

  async chat(
    systemPrompt: string,
    userPrompt: string,
    responseSchema: Record<string, unknown>,
  ): Promise<AIChatResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "response_schema",
            strict: true,
            schema: responseSchema,
          },
        },
      });
      const content = response.choices[0].message.content;
      if (!content) throw new Error("No content");
      const parsedContent = JSON.parse(content);
      return {
        content: parsedContent,
        usage: response.usage
          ? {
            model: response.model ?? this.model,
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
          }
          : null,
      };
    } catch (error) {
      console.error("OpenAI API request failed:", error);
      throw error;
    }
  }
}
