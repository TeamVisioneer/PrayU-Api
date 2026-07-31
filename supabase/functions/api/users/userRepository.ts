import { supabase } from "../../client.ts";

export class UserRepository {
  /** 이 사용자가 그룹장인 그룹들 (이미 소프트 삭제된 그룹 제외) */
  async findLedGroupIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("group")
      .select("id")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) throw new Error(`findLedGroupIds: ${error.message}`);
    return (data ?? []).map((g) => g.id);
  }

  /**
   * 그룹장을 넘길 다음 사람. **가장 먼저 들어온 멤버**를 고른다.
   * 남은 멤버가 없으면 null — 호출부가 그룹을 소프트 삭제한다.
   */
  async findNextLeaderId(
    groupId: string,
    excludeUserId: string,
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from("member")
      .select("user_id")
      .eq("group_id", groupId)
      .neq("user_id", excludeUserId)
      .is("deleted_at", null)
      .not("user_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) throw new Error(`findNextLeaderId: ${error.message}`);
    return data?.[0]?.user_id ?? null;
  }

  async transferGroupLeadership(groupId: string, newLeaderId: string) {
    const { error } = await supabase
      .from("group")
      .update({ user_id: newLeaderId })
      .eq("id", groupId);

    if (error) throw new Error(`transferGroupLeadership: ${error.message}`);
  }

  async softDeleteGroup(groupId: string, deletedAt: string) {
    const { error } = await supabase
      .from("group")
      .update({ deleted_at: deletedAt })
      .eq("id", groupId)
      .is("deleted_at", null);

    if (error) throw new Error(`softDeleteGroup: ${error.message}`);
  }

  /** 모든 그룹에서 나간다. web 의 그룹 나가기와 같은 방식(deleted_at + pray_summary 비움) */
  async leaveAllGroups(userId: string, deletedAt: string) {
    const { error } = await supabase
      .from("member")
      .update({ deleted_at: deletedAt, pray_summary: null })
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) throw new Error(`leaveAllGroups: ${error.message}`);
  }

  /**
   * 탈퇴 표시를 남긴다.
   *
   * **행의 다른 값은 건드리지 않는다.** 탈퇴 뒤에도 문의 대응·이상 행위 추적 같은 운영이
   * 필요하고, 지워버리면 되돌릴 방법이 없다. 노출은 표시 계층이 `deleted_at` 을 보고 막는다.
   *
   * 개인정보 **파기**는 이 단계의 책임이 아니다 — 나중에 돌릴 배치 하드 삭제가 진다
   * (docs/archive/account-deletion-plan.md "한계" 절).
   *
   * 참고: `push_notification` 은 함수 어디서도 읽지 않는다(푸시는 OneSignal 경로).
   * 비워도 동작이 달라지지 않아 남겨 둔다.
   */
  async markProfileDeleted(userId: string, deletedAt: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: deletedAt })
      .eq("id", userId);

    if (error) throw new Error(`markProfileDeleted: ${error.message}`);
  }

  /**
   * auth 계정을 소프트 삭제한다.
   *
   * 하드 삭제(`deleteUser(id)`)는 `profiles_id_fkey`(NO ACTION) 때문에 **항상 실패**한다.
   * 소프트 삭제는 이메일·비밀번호·메타데이터와 **identity 까지 익명화**하므로,
   * 카카오로 다시 로그인해도 같은 계정으로 돌아오지 못한다 (새 계정이 생긴다).
   */
  async softDeleteAuthUser(userId: string) {
    const { error } = await supabase.auth.admin.deleteUser(userId, true);
    if (error) throw new Error(`softDeleteAuthUser: ${error.message}`);
  }
}
