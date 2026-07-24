// QT 응답 구조 — 웹 QTData 타입(PrayU-web/src/apis/openai.ts)과 동일 형태를 유지해야 한다
export const QTResponseSchema = {
  "type": "object",
  "properties": {
    "scripture": {
      "type": "object",
      "properties": {
        "text": { "type": "string", "description": "성경 본문 내용" },
        "reference": { "type": "string", "description": "성경 본문 출처" },
      },
      "required": ["text", "reference"],
      "additionalProperties": false,
    },
    "meditation": {
      "type": "object",
      "properties": {
        "introduction": { "type": "string", "description": "묵상의 도입부" },
        "key_messages": {
          "type": "array",
          "description": "주요 메시지 3가지",
          "items": {
            "type": "object",
            "properties": {
              "title": { "type": "string", "description": "주요 메시지 제목" },
              "points": {
                "type": "array",
                "description": "메시지 내용과 세부 메시지",
                "items": { "type": "string" },
              },
            },
            "required": ["title", "points"],
            "additionalProperties": false,
          },
        },
      },
      "required": ["introduction", "key_messages"],
      "additionalProperties": false,
    },
    "application_questions": {
      "type": "array",
      "description": "적용 질문 3개",
      "items": {
        "type": "object",
        "properties": {
          "question": { "type": "string", "description": "적용 질문 내용" },
        },
        "required": ["question"],
        "additionalProperties": false,
      },
    },
    "practical_tasks": {
      "type": "array",
      "description": "오늘 실천할 수 있는 구체적인 행동 3가지",
      "items": {
        "type": "object",
        "properties": {
          "task": { "type": "string", "description": "실천할 수 있는 행동 내용" },
        },
        "required": ["task"],
        "additionalProperties": false,
      },
    },
  },
  "required": [
    "scripture",
    "meditation",
    "application_questions",
    "practical_tasks",
  ],
  "additionalProperties": false,
} as const;
