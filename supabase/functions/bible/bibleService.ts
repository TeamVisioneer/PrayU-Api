// import { GeminiClient } from "../_shared/ai/geminiClient.ts";
import { OpenaiClient } from "../_shared/ai/openaiClient.ts";
import { AIClient } from "../_shared/ai/aiClient.ts";
import { BibleRepository } from "./bibleRepository.ts";
import {
  BibleSearchResponse,
  BibleSearchResponseSchema,
} from "./bibleSchema.ts";
import { Bible } from "../_types/table.ts";

export class BibleService {
  private aiClient: AIClient;
  private bibleRepository: BibleRepository;

  constructor() {
    this.aiClient = new OpenaiClient(Deno.env.get("OPENAI_SECRET_KEY") || "");
    this.bibleRepository = new BibleRepository();
  }

  async searchBible(userPrompt: string) {
    const systemPrompt = `
      role: 성경 전문가 및 신앙 상담 전문가
      task: 사용자가 입력한 기도제목을 위한 성경 말씀 구절 추천
      rules:
        - 성경 말씀 구절은 성경책 이름, 장, 절을 포함합니다.
        - 성경 말씀 구절 본문은 포함하지 않습니다.
        - 성경 말씀 구절은 3개 찾아주세요.
        - 응답은 정해진 JSON 형식으로 응답하세요.
      example:
        {
          "bible": [
            {
              "longLabel": "로마서",
              "chapter": 1,
              "paragraph": 1,
            },
            {
              "longLabel": "사도행전",
              "chapter": 2, 
              "paragraph": 4,
            },
            {
              "longLabel": "디모데전서",
              "chapter": 4,
              "paragraph": 1,
            },
          ],
          "keywords": ["키워드1", "키워드2", "키워드3"],
        }
    `;

    const rawResponse = await this.aiClient.chat(
      systemPrompt,
      userPrompt,
      BibleSearchResponseSchema,
    );

    const chatResponse = BibleSearchResponse.parse(rawResponse);
    const bibleList = await Promise.all(
      chatResponse.bible.map(
        async (
          item: { longLabel: string; chapter: number; paragraph: number },
        ) => {
          const bible = await this.bibleRepository.getBible(
            item.longLabel,
            item.chapter,
            item.paragraph,
          );
          return bible;
        },
      ),
    );

    return {
      bible: bibleList.filter((bible: Bible | null) => bible !== null),
      keywords: chatResponse.keywords,
    };
  }
}
