import { BibleRepository } from "./BibleRepository.ts";
import { OpenaiClient } from "./openaiClient.ts";
import { PixelsClient } from "./pixelsClient.ts";
import { Photo } from "./type.ts";

export class BibleCardService {
  private openaiClient;
  private pixesClient;
  private bibleRepository;

  constructor() {
    this.openaiClient = new OpenaiClient();
    this.pixesClient = new PixelsClient();
    this.bibleRepository = new BibleRepository();
  }

  async getBibleMessage(content: string) {
    const prompt: string = `
      사용자가 입력한 기도제목: ${content}

      당신은 영적 상담가이자 성경 전문가입니다. 
      사용자가 기도제목을 입력하면 해당 기도제목과 관련된 3개의 핵심 키워드를 뽑아주세요.
      각 키워드에 대해 성경 말씀 구절을 성경책 이름과 장, 절을 응답해 주세요.
      성경 본문과 키워드를 통해 연상할 수 있는 자연 배경 검색어를 한단어 영어로 제시해주세요. 
      
      아래와 같은 JSON 형식으로 응답하세요:
      {
        "data": [
          {
            "keyword": "키워드1",
            "long_label": "성경책 이름",
            "chapter": 00,
            "paragraph": 00,
            "sentence": "성경 본문",
            "nature": "자연 배경 검색어",
          },
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

  async searchBible(embedding: string) {
    const response = await this.bibleRepository.searchBible(embedding);
    if (!response) return null;
    return response;
  }
}
