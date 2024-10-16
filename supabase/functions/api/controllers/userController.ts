import { Context } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { ServiceUser } from "../entities/user.ts";
import { UserRepository } from "../repositories/userRepository.ts";

export class UserController {
  private UserRepository: UserRepository;

  constructor() {
    this.UserRepository = new UserRepository();
  }

  async deleteUserV1(c: Context) {
    const user = c.get("user") as ServiceUser;
    const result = await this.UserRepository.deleteUser(user.id);
    return c.json(
      result ? "User deleted successfully" : "Failed to delete user",
    );
  }

  async getFCMTokensV1(c: Context) {
    const user = c.get("user") as ServiceUser;
    const tokens = await this.UserRepository.getFCMTokensByUserID(user.id);
    return c.json(tokens);
  }

  async postFCMTokenV1(c: Context) {
    const user = c.get("user") as ServiceUser;
    const { fcmToken } = await c.req.json();
    if (!fcmToken) {
      return c.json("Missing userID or fcmToken");
    }
    const result = await this.UserRepository.addFCMToken(
      user.id,
      fcmToken,
    );
    return c.json(
      result ? "FCM token added successfully" : "Failed to add FCM token",
    );
  }

  async deleteFCMTokenV1(c: Context) {
    const user = c.get("user") as ServiceUser;

    const { fcmToken } = await c.req.json();
    if (!fcmToken) {
      return c.json("Missing userID or fcmToken");
    }
    const result = await this.UserRepository.deleteFCMToken(
      user.id,
      fcmToken,
    );
    return c.json(
      result ? "FCM token deleted successfully" : "Failed to delete FCM token",
    );
  }
}
