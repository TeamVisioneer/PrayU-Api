import { User as SupabaseUser } from "https://esm.sh/@supabase/supabase-js@2.44.3";

export class ServiceUser {
  id: string;
  email: string | null;
  createdAt: string;

  constructor(id: string, email: string | null, createdAt: string) {
    this.id = id;
    this.email = email;
    this.createdAt = createdAt;
  }

  static fromUser(user: SupabaseUser): ServiceUser {
    return new ServiceUser(
      user.id,
      user.email ?? null,
      user.created_at,
    );
  }
}
