import { OpenaiClient } from "./openaiClient.ts";
import { PixelsClient } from "./pixelsClient.ts";
import { Photo } from "./type.ts";

export class BibleCardService {
  private openaiClient;
  private pixesClient;

  constructor() {
    this.openaiClient = new OpenaiClient();
    this.pixesClient = new PixelsClient();
  }

  async getBibleMessage(content: string) {
    const prompt: string = `
      사용자가 입력한 기도제목: ${content}

      당신은 영적 상담가이자 성경 전문가입니다. 
      사용자가 기도제목을 입력하면 해당 기도제목과 관련된 3개의 핵심 키워드를 뽑아주세요.
      각 키워드에 대해 성경 말씀 1구절을 개역개정 본문 그대로 제시하고, 성경책 이름과 장, 절을 "00장(또는 편) 00절" 형식으로 응답하세요.
      성경 본문에 적절한 개행 문자를 추가하여 반환하고,
      성경 본문과 키워드를 통해 연상할 수 있는 자연물 검색어(star, mountain, sky, river 등)를 한단어 영어로 제시해주세요. 
      
      아래와 같은 JSON 형식으로 응답하세요:
      {
        "data": [
          {
            "keyword": "키워드1",
            "verse": "성경책 이름 00장(또는 편) 00절",
            "body": "적절한 개행이 포함된 성경구절 내용"
            "nature": "자연 배경 검색어",
          },
          {
            "keyword": "키워드2",
            "verse": "성경책 이름 00장(또는 편) 00절",
            "body": "적절한 개행이 포함된 성경구절 내용"
            "nature": "자연 배경 검색어",
          },
          {
            "keyword": "키워드3",
            "verse": "성경책 이름 00장(또는 편) 00절",
            "body": "적절한 개행이 포함된 성경구절 내용"
            "nature": "자연 배경 검색어",
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

  async getNatureImage(content: string) {
    const apiResponse = await this.pixesClient.searchPhotos(content, 2);
    if (!apiResponse) return null;
    const data = apiResponse.photos.map((photo: Photo) =>
      photo.src.original + "?auto=compress&cs=tinysrgb&fit=crop&h=1024&w=1024"
    );
    return data;
  }

  async getEmbeddingText(content: string) {
    const apiResponse = await this.openaiClient.createEmbeddingText(
      content,
    );
    if (!apiResponse) return null;
    return apiResponse.data[0].embedding;
  }
}
