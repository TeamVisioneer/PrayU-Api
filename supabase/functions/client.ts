import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.3";
import { Database } from "./_types/database.ts";

// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY는 런타임이 자동 주입한다
// (로컬 serve → 로컬 스택, 배포 → 해당 프로젝트). 별도 시크릿 설정 불필요
export const supabase = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
