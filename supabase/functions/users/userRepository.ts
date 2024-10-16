import { supabase } from "../client.ts";
import { User } from "https://esm.sh/@supabase/supabase-js@2.44.3";

export class UserRepository {
  async createUser(email: string, name: string): Promise<User | null> {
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      user_metadata: { full_name: name },
    });
    if (error) {
      console.error("Error creating user:", error.message);
      return null;
    }
    return data.user;
  }

  async deleteUser(userId: string): Promise<User | null> {
    const { data, error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error("Error deleting user:", error.message);
      return null;
    }
    return data.user;
  }
}
