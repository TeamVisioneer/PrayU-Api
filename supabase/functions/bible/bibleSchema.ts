import { z } from "npm:zod";

export const BibleSearchResponse = z.object({
  bible: z.array(z.object({
    longLabel: z.string().describe(
      "성경책 이름 (예: 로마서, 마태복음, 사도행전)",
    ),
    chapter: z.number().int().describe("장 번호"),
    paragraph: z.number().int().describe("절 번호"),
  })),
  keywords: z.array(z.string().describe("사용자 입력 내용 기반 키워드")),
});

export const BibleSearchResponseSchema = {
  "type": "object",
  "properties": {
    "bible": {
      "type": "array",
      "description": "성경 말씀 구절 목록",
      "items": {
        "type": "object",
        "properties": {
          "longLabel": {
            "type": "string",
            "description": "성경책 이름 (예: 로마서, 마태복음, 사도행전)",
          },
          "chapter": {
            "type": "integer",
            "description": "장 번호",
          },
          "paragraph": {
            "type": "integer",
            "description": "절 번호",
          },
        },
        "required": ["longLabel", "chapter", "paragraph"],
        "additionalProperties": false,
      },
    },
    "keywords": {
      "type": "array",
      "description": "사용자 입력 내용 기반 키워드",
      "items": {
        "type": "string",
      },
    },
  },
  "required": ["bible", "keywords"],
  "additionalProperties": false,
} as const;
