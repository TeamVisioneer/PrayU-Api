import { Context, Next } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { corsHeaders } from "./cors.ts";
import { decode } from "https://deno.land/x/djwt@v2.8/mod.ts";

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
  console.log("Processing request with JWT token");

  const userId = decodeJWT(jwt);
  if (!userId) {
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

  console.log("Successfully authenticated user:", userId);
  c.set("userId", userId);
  await next();
}

function decodeJWT(jwt: string): string | null {
  try {
    const [_, payload] = decode(jwt);
    return payload ? (payload as { sub: string }).sub : null;
  } catch (err) {
    console.error("Error decoding JWT:", err);
    return null;
  }
}
