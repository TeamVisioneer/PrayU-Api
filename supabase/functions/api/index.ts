import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import userRouter from "./users/userRouter.ts";

const app = new Hono();

app.basePath("/api")
  .route("/users", userRouter);

Deno.serve(app.fetch);
