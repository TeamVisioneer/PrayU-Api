import { supabase } from "../../client.ts";

export class AdminRepository {
  /** 호출자가 관리자인가. 행이 없으면 false — 없는 계정에 권한을 주지 않는다 */
  async isAdmin(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw new Error(`isAdmin: ${error.message}`);
    return data?.is_admin === true;
  }

  /**
   * 대상의 프리미엄 만료일을 설정한다 (null = 해제).
   * 갱신된 행을 돌려받아 **대상 존재 여부를 구분**한다 — 없는 uuid 면 빈 배열이다.
   */
  async setPremiumExpiry(
    userId: string,
    premiumExpiredAt: string | null,
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from("profiles")
      .update({ premium_expired_at: premiumExpiredAt })
      .eq("id", userId)
      .select("id");

    if (error) throw new Error(`setPremiumExpiry: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }
}
