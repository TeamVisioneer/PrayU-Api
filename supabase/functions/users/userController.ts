import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { ServiceUser } from "./userEntity.ts";
import { UserRepository } from "./userRepository.ts";

export class UserController {
  private UserRepository: UserRepository;

  constructor() {
    this.UserRepository = new UserRepository();
  }

  async createUserV1(c: Context) {
    const { email, name } = await c.req.json();
    if (!email || !name) {
      return c.json({ message: "Email and name are required" }, 400);
    }
    const user = await this.UserRepository.createUser(email, name);
    return c.json(user);
  }

  async deleteUserV1(c: Context) {
    const user = c.get("user") as ServiceUser;
    const result = await this.UserRepository.deleteUser(user.id);
    return c.json(
      result ? "User deleted successfully" : "Failed to delete user",
    );
  }
}
