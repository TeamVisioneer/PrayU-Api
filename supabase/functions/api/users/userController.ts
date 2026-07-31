import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { UserService } from "./userService.ts";
import { corsHeaders } from "../../_shared/cors.ts";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /** 본인 계정 탈퇴 (소프트 삭제). 자기 것만 지울 수 있다 — 대상은 토큰에서만 온다 */
  async deleteUserV1(c: Context) {
    const userId = c.get("userId");
    // 탈퇴는 로그인 사용자 본인만. 인프라 호출자도 쓸 일이 없다
    if (!userId || userId === "anon" || userId === "service_role") {
      return json({ data: null, error: "Unauthorized" }, 401);
    }

    try {
      await this.userService.softDeleteUser(userId);
      return json({ data: true, error: null }, 200);
    } catch (error) {
      // 어느 단계에서 멈췄는지가 중요하다 — 메시지에 단계 이름이 들어 있다
      console.error("Failed to delete user:", userId, error);
      return json({ data: null, error: "Failed to delete user" }, 500);
    }
  }
}
