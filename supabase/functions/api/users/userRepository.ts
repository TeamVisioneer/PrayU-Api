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
   * 개인 식별정보를 지우고 탈퇴 표시를 남긴다.
   *
   * GoTrue 소프트 삭제는 `auth.users` 만 익명화하고 `public.profiles` 는 건드리지 않는다 —
   * 개인정보를 지우는 것은 여기서 해야 한다.
   *
   * 이름은 **비운다.** "(탈퇴유저)" 같은 표시 문자열을 데이터에 넣지 않는다 —
   * 표시는 화면의 몫이고, 데이터에 넣으면 문구를 바꿀 때 DB 를 고쳐야 한다.
   * web 은 `deleted_at` 을 보고 표시한다.
   */
  async anonymizeProfile(userId: string, deletedAt: string) {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: null,
        avatar_url: null,
        username: null,
        website: null,
        kakao_id: null,
        // fcm_token 은 NOT NULL 이라 빈 문자열이 "없음"이다 (기본값도 '')
        fcm_token: "",
        push_notification: false,
        kakao_notification: false,
        blocking_users: [],
        is_admin: false,
        premium_expired_at: null,
        // 기존 web 탈퇴 흐름이 지우던 값 — 서버가 절차를 가져오면서 함께 옮긴다
        terms_agreed_at: null,
        deleted_at: deletedAt,
      })
      .eq("id", userId);

    if (error) throw new Error(`anonymizeProfile: ${error.message}`);
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
