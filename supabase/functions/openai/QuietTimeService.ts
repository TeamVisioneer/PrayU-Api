import { OpenaiClient } from "../_shared/ai/openaiClient.ts";
import { AIClient } from "../_shared/ai/aiClient.ts";
import { LlmUsageRepository } from "../_shared/llmUsageRepository.ts";
import { QTResponseSchema } from "./qtSchema.ts";

// QT 일일 생성 한도 — qt 피처의 정책이므로 이 파일에 둔다 (서버가 진실)
const DAILY_LIMIT = Number(Deno.env.get("QT_DAILY_LIMIT") ?? "10");

export class QtDailyLimitExceededError extends Error {
  constructor(public limit: number, public used: number) {
    super("DAILY_LIMIT_EXCEEDED");
  }
}

export class QuietTimeService {
  private aiClient: AIClient;
  private llmUsageRepository: LlmUsageRepository;

  constructor() {
    this.aiClient = new OpenaiClient(Deno.env.get("OPENAI_SECRET_KEY") || "");
    this.llmUsageRepository = new LlmUsageRepository();
  }

  async getQTcontent(userId: string, content: string) {
    const used = await this.llmUsageRepository.countToday(userId, "qt");
    if (used >= DAILY_LIMIT) {
      throw new QtDailyLimitExceededError(DAILY_LIMIT, used);
    }

    // LLM 호출 "전"에 기록해 실패·타임아웃 호출도 차감 (재시도 폭탄 방지)
    const usageLogId = await this.llmUsageRepository.insert(userId, "qt", {});

    const systemPrompt = `
    내가 지정한 성경 본문과 다음 지시에 따라 20-30대 크리스천을 위한 QT를 JSON 형식으로 작성해 주세요.

    - 내용 구성:
        - "scripture": 성경 본문 텍스트와 출처
        - "meditation": 간단한 묵상 내용으로, 20-30대가 이해하기 쉽게 표현된 도입부와 주요 메시지 3가지 (각 메시지에 소제목과 간단한 설명 포함)
        - "application_questions": 20-30대 크리스천의 삶과 밀접하게 관련된 최신 상황과 함께 사회적 문제에 공감할 수 있는 3개의 적용 질문. 행동으로 유도할 수 있는 질문.
        - "practical_tasks": 일상에서 오늘 실천할 수 있는 구체적인 행동 3가지, 쉽고 현실적이며 영적 성장에 도움이 될 수 있는 내용
        - 말투는 존댓말로 공손하게 작성
    `;
    const userPrompt = `성경 본문: ${content}`;

    const { content: qtContent, usage } = await this.aiClient.chat(
      systemPrompt,
      userPrompt,
      QTResponseSchema,
    );
    if (usage) {
      // 토큰 기록 실패는 본 흐름을 막지 않는다
      this.llmUsageRepository.updateUsage(usageLogId, usage).catch(
        console.error,
      );
    }

    return qtContent;
  }
}
