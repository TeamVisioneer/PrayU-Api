import { ShareRewardRepository } from "../_shared/shareRewardRepository.ts";

// 보상 대상 피처 화이트리스트 — 1차는 말씀카드만
const REWARDABLE_FEATURES = new Set(["bible_card"]);

interface GrantRewardInput {
  userId: string;
  feature: string;
  chatType: string | null;
  hashChatId: string | null;
}

export interface GrantRewardResult {
  granted: boolean;
  reason?: string;
}

// 지급 규칙 (docs 2-3장, 2026-07-27 확정):
// 공유 1회 = +1 (당일 한정, 일일 상한 없음) / 나와의 채팅 미인정 / 동일 채팅방 1일 1회
export class ShareRewardService {
  private shareRewardRepository: ShareRewardRepository;

  constructor() {
    this.shareRewardRepository = new ShareRewardRepository();
  }

  async grantReward(input: GrantRewardInput): Promise<GrantRewardResult> {
    const { userId, feature, chatType, hashChatId } = input;

    if (!REWARDABLE_FEATURES.has(feature)) {
      return { granted: false, reason: `feature not rewardable: ${feature}` };
    }
    if (!userId) {
      return { granted: false, reason: "missing user_id" };
    }
    if (chatType === "MemoChat") {
      return { granted: false, reason: "MemoChat not rewardable" };
    }
    if (!hashChatId) {
      return { granted: false, reason: "missing HASH_CHAT_ID" };
    }

    const alreadyRewarded = await this.shareRewardRepository.existsTodayInRoom(
      userId,
      hashChatId,
    );
    if (alreadyRewarded) {
      return { granted: false, reason: "already rewarded in this room today" };
    }

    await this.shareRewardRepository.insert(userId, feature, chatType, hashChatId);
    return { granted: true };
  }
}
