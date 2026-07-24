export interface AIUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface AIChatResult {
  content: Record<string, unknown>;
  usage: AIUsage | null;
}

export interface AIClient {
  chat(
    systemPrompt: string,
    userPrompt: string,
    responseSchema: Record<string, unknown>,
  ): Promise<AIChatResult>;
}
