import { supabase } from "../../client.ts";

export class UserRepository {
  async deleteUser(userId: string): Promise<boolean> {
    try {
      console.log(`Attempting to delete user with ID: ${userId}`);

      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) {
        console.error("Error deleting user:", error.message);
        return false;
      }

      console.log("User deleted successfully");
      return true;
    } catch (err) {
      console.error("Unexpected error during user deletion:", err);
      return false;
    }
  }
}
