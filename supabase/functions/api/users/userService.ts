import { UserRepository } from "./userRepository.ts";

/**
 * 회원 탈퇴 — 소프트 삭제 (docs/account-deletion-plan.md).
 *
 * 하드 삭제는 `profiles_id_fkey`(NO ACTION) 때문에 **항상 실패**해 왔다.
 * 계정을 못 쓰게 만들고 개인 식별정보를 지우되, 함께 나눈 기도 기록은 남긴다 —
 * 지우면 **상대방 화면에서도 사라지기** 때문이다.
 *
 * 순서가 있는 다단계 절차라 리포지토리(데이터 조작)나 컨트롤러(권한 검사)가 아니라
 * 서비스에 둔다.
 */
export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * 탈퇴를 수행한다.
   *
   * **auth 소프트 삭제를 마지막에 두는 이유**: 거기서 세션이 끊긴다.
   * 먼저 하면 이후 단계가 실패했을 때 사용자는 로그인도 못 하는데 개인정보는 남고,
   * 스스로 재시도할 방법이 없다. 반대 순서면 실패해도 개인정보는 이미 지워졌고
   * 다시 시도할 수 있다.
   *
   * 각 단계는 **재실행 안전**하다 — 중간에 실패해 다시 눌러도 정상 완료된다.
   */
  async softDeleteUser(userId: string): Promise<void> {
    const deletedAt = new Date().toISOString();

    await this.handOverLedGroups(userId, deletedAt);
    await this.userRepository.leaveAllGroups(userId, deletedAt);
    await this.userRepository.anonymizeProfile(userId, deletedAt);
    await this.userRepository.softDeleteAuthUser(userId);
  }

  /**
   * 그룹장인 그룹을 넘긴다. 남은 멤버 중 **가장 먼저 들어온 사람**이 새 그룹장이다.
   * 남은 멤버가 없으면 그룹을 소프트 삭제한다 — 그룹장도 멤버도 없는 그룹은 의미가 없다.
   *
   * 새 그룹장에게 알리는 흐름은 이번 범위 밖이다 (알림 설계가 따로 필요하다).
   */
  private async handOverLedGroups(userId: string, deletedAt: string) {
    const groupIds = await this.userRepository.findLedGroupIds(userId);

    for (const groupId of groupIds) {
      const nextLeaderId = await this.userRepository.findNextLeaderId(
        groupId,
        userId,
      );

      if (nextLeaderId) {
        await this.userRepository.transferGroupLeadership(
          groupId,
          nextLeaderId,
        );
      } else {
        await this.userRepository.softDeleteGroup(groupId, deletedAt);
      }
    }
  }
}
