import { GeminiClient } from "../_shared/ai/geminiClient.ts";
import { BibleRepository } from "./bibleRepository.ts";
import { BibleSearchResponse } from "./bibleSchema.ts";

export class BibleService {
  private aiClient: GeminiClient;
  private bibleRepository: BibleRepository;

  constructor() {
    this.aiClient = new GeminiClient(Deno.env.get("GEMINI_API_KEY") || "");
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
          "data": [
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
        }
    `;
    const responseSchema = {
      type: "object",
      properties: {
        data: {
          type: "array",
          description: "성경 말씀 구절 목록",
          items: {
            type: "object",
            properties: {
              longLabel: {
                type: "string",
                description: "성경책 이름 (예: 로마서, 마태복음, 사도행전)",
              },
              chapter: {
                type: "integer",
                description: "장 번호",
              },
              paragraph: {
                type: "integer",
                description: "절 번호",
              },
            },
            required: ["longLabel", "chapter", "paragraph"],
          },
        },
      },
      required: ["data"],
    };
    const chatResponse = await this.aiClient.chat(
      systemPrompt,
      userPrompt,
      responseSchema,
    );
    const parsedResponse = BibleSearchResponse.parse(chatResponse);
    const bibleList = await Promise.all(
      parsedResponse.data.map(async (item) => {
        const bible = await this.bibleRepository.getBible(
          item.longLabel,
          item.chapter,
          item.paragraph,
        );
        return bible;
      }),
    );

    return bibleList.filter((bible) => bible !== null);
  }
}
