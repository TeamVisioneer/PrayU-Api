export interface AIClient {
  chat(
    systemPrompt: string,
    userPrompt: string,
    responseSchema: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}
