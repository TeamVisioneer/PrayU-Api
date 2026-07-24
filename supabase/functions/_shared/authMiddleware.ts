import { Context, Next } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { corsHeaders } from "./cors.ts";
import { supabase } from "../client.ts";

export async function authMiddleware(c: Context, next: Next) {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("Invalid or missing Authorization header");
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        details: "Invalid or missing Authorization header",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const jwt = authHeader.split(" ")[1];

  // 인프라 호출자(pg_cron 등)는 service_role 키 소지로 인증 — 사용자 검증 경로와 분리
  if (jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    c.set("userId", "service_role");
    await next();
    return;
  }

  // 이 프로젝트의 anon 키만 anon으로 인정 (허용 여부는 각 라우트가 결정)
  if (jwt === Deno.env.get("SUPABASE_ANON_KEY")) {
    c.set("userId", "anon");
    await next();
    return;
  }

  // 사용자 토큰: 서명·만료를 auth 서버에 위임 검증 (게이트웨이 verify_jwt에 의존하지 않는다)
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) {
    console.error("Failed to authenticate user with provided JWT token");
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        details: "Invalid authentication token",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  c.set("userId", user.id);
  await next();
}
