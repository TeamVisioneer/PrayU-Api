import type { AIClient } from "./aiClient.ts";

export class GeminiClient implements AIClient {
  private apiKey: string;
  private model: string = "gemini-2.5-flash";
  private baseUrl: string = "https://generativelanguage.googleapis.com/v1beta";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
  }

  async chat(
    systemPrompt: string,
    userPrompt: string,
    responseSchema: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const url = `${this.baseUrl}/models/${this.model}:generateContent`;

      const requestBody = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema,
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = JSON.parse(text);
      return parsed as Record<string, unknown>;
    } catch (error) {
      console.error("Gemini API request failed:", error);
      throw error;
    }
  }
}
