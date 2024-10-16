import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { ServiceUser } from "./userEntity.ts";
import { UserRepository } from "./userRepository.ts";
import { corsHeaders } from "../_shared/cors.ts";

export class UserController {
  private UserRepository: UserRepository;

  constructor() {
    this.UserRepository = new UserRepository();
  }

  async createUserV1(c: Context) {
    const { email, name, method } = await c.req.json();
    if (method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (!email || !name) {
      return new Response(
        JSON.stringify({
          data: null,
          error: "Email and name are required",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }
    const result = await this.UserRepository.createUser(email, name);
    if (!result) {
      return new Response(
        JSON.stringify({ data: null, error: "Failed to create user" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    return new Response(
      JSON.stringify({ data: result, error: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  async deleteUserV1(c: Context) {
    const user = c.get("user") as ServiceUser;
    const result = await this.UserRepository.deleteUser(user.id);
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
