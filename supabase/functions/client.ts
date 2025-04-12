import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.3";
import { Database } from "./_types/database.ts";

export const supabase = createClient<Database>(
  Deno.env.get("SUPA_PROJECT_URL")!,
  Deno.env.get("SUPA_PROJECT_SERVICE_ROLE_KEY")!,
);
