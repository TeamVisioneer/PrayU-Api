import { ServiceUser } from "./userEntity.ts";
import { supabase } from "../client.ts";
import { Context, Next } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { corsHeaders } from "./cors.ts";

export async function authMiddleware(c: Context, next: Next) {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const jwt = authHeader.split(" ")[1];
  const serviceUser = await decodeJWT(jwt);
  if (serviceUser) c.set("user", serviceUser);
  await next();
}

async function decodeJWT(jwt: string): Promise<ServiceUser | null> {
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || data.user == null) return null;
  return ServiceUser.fromUser(data.user);
}
