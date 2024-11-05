import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import openaiRouter from "./openaiRouter.ts";

const app = new Hono();

app.basePath("/openai")
  .route("/", openaiRouter);

Deno.serve(app.fetch);
