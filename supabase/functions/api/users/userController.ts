import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { UserRepository } from "./userRepository.ts";
import { corsHeaders } from "../../_shared/cors.ts";

export class UserController {
  private UserRepository: UserRepository;

  constructor() {
    this.UserRepository = new UserRepository();
  }

  async deleteUserV1(c: Context) {
    const userId = c.get("userId");
    console.log("userId", userId);
    const result = await this.UserRepository.deleteUser(userId);
    if (!result) {
      return new Response(
        JSON.stringify({ data: null, error: "Failed to delete user" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }
    return new Response(
      JSON.stringify({ data: result, error: null }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
}
