import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import OnesignalRouter from "./onesignalRouter.ts";

const app = new Hono();

app.basePath("/onesignal")
  .route("/", OnesignalRouter);

Deno.serve(app.fetch);
