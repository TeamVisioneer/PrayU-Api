// import { GeminiClient } from "../_shared/ai/geminiClient.ts";
import { OpenaiClient } from "../_shared/ai/openaiClient.ts";
import { AIClient } from "../_shared/ai/aiClient.ts";
import { BibleRepository } from "./bibleRepository.ts";
import {
  BibleSearchResponse,
  BibleSearchResponseSchema,
} from "./bibleSchema.ts";
import { Bible } from "../_types/table.ts";
import { LlmUsageRepository } from "../_shared/llmUsageRepository.ts";

// 말씀카드 일일 생성 한도 — bible_card 피처의 정책이므로 이 파일에 둔다 (서버가 진실, web 상수는 표시용)
const DAILY_LIMIT = Number(Deno.env.get("BIBLE_CARD_DAILY_LIMIT") ?? "3");

export class DailyLimitExceededError extends Error {
  constructor(public limit: number, public used: number) {
    super("DAILY_LIMIT_EXCEEDED");
  }
}

export class BibleService {
  private aiClient: AIClient;
  private bibleRepository: BibleRepository;
  private llmUsageRepository: LlmUsageRepository;

  constructor() {
    this.aiClient = new OpenaiClient(Deno.env.get("OPENAI_SECRET_KEY") || "");
    this.bibleRepository = new BibleRepository();
    this.llmUsageRepository = new LlmUsageRepository();
  }

  async searchBible(userId: string, userPrompt: string, prayCardId?: string) {
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

    const used = await this.llmUsageRepository.countToday(userId, "bible_card");
    if (used >= DAILY_LIMIT) {
      throw new DailyLimitExceededError(DAILY_LIMIT, used);
    }

    // LLM 호출 "전"에 기록해 실패·타임아웃 호출도 차감 (재시도 폭탄 방지)
    const usageLogId = await this.llmUsageRepository.insert(userId, "bible_card", {
      pray_card_id: prayCardId ?? null,
    });

    const { content, usage } = await this.aiClient.chat(
      systemPrompt,
      userPrompt,
      BibleSearchResponseSchema,
    );
    if (usage) {
      // 토큰 기록 실패는 본 흐름을 막지 않는다
      this.llmUsageRepository.updateUsage(usageLogId, usage).catch(console.error);
    }

    const chatResponse = BibleSearchResponse.parse(content);
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
