import { ServiceUser } from "./userEntities.ts";
import { supabase } from "../client.ts";
import { Context, Next } from "https://deno.land/x/hono@v4.3.11/mod.ts";

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ code: 401, message: "Unauthorized" }, 401);
  }

  const jwt = authHeader.split(" ")[1];
  const serviceUser = await decodeJWT(jwt);
  if (!serviceUser) {
    return c.json({ code: 401, message: "Unauthorized" }, 401);
  }

  c.set("user", serviceUser);
  await next();
}

async function decodeJWT(jwt: string): Promise<ServiceUser | null> {
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error) {
    console.error("JWT verification failed:", error.message);
    return null;
  }
  if (data.user == null) {
    console.error("User not exist");
    return null;
  }

  return ServiceUser.fromUser(data.user);
}
