import { OpenaiClient } from "./openaiClient.ts";

export class QuietTimeService {
  private openaiClient;

  constructor() {
    this.openaiClient = new OpenaiClient();
  }

  async getQTcontent(content: string) {
    const prompt: string = `
    내가 지정한 성경 본문과 다음 지시에 따라 20-30대 크리스천을 위한 QT를 JSON 형식으로 작성해 주세요.

    - 성경 본문: ${content}
    - 내용 구성:
        - "scripture": 성경 본문 텍스트와 출처
        - "meditation": 간단한 묵상 내용으로, 20-30대가 이해하기 쉽게 표현된 도입부와 주요 메시지 3가지 (각 메시지에 소제목과 간단한 설명 포함)
        - "application_questions": 20-30대 크리스천의 삶과 밀접하게 관련된 최신 상황과 함께 사회적 문제에 공감할 수 있는 3개의 적용 질문. 행동으로 유도할 수 있는 질문.
        - "practical_tasks": 일상에서 오늘 실천할 수 있는 구체적인 행동 3가지, 쉽고 현실적이며 영적 성장에 도움이 될 수 있는 내용
        - 말투는 존댓말로 공손하게 작성

    JSON 형식 예시:
    {
        "scripture": {
            "text": "성경 본문 내용",
            "reference": "성경 본문 출처"
        },
        "meditation": {
            "introduction": "묵상의 도입부",
            "key_messages": [
                {
                    "title": "주요 메시지 제목",
                    "points": ["메시지 내용", "세부 메시지"]
                }
            ]
        },
        "application_questions": [
            {
                "question": "적용 질문 내용"
            }
        ],
        "practical_tasks": [
            {
                "task": "실천할 수 있는 행동 내용"
            }
        ]
    }
    `;
    const apiResponse = await this.openaiClient.generateText(
      prompt,
    );
    if (!apiResponse) return null;
    const contentString = apiResponse?.choices[0]?.message?.content || "{}";
    const contentJson = JSON.parse(contentString);
    return contentJson;
  }
}