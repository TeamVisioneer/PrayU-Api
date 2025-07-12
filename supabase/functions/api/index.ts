import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import userRouter from "./users/userRouter.ts";
import churchRouter from "./churches/churchRouter.ts";

const app = new Hono();

app.basePath("/api")
  .route("/users", userRouter)
  .route("/churches", churchRouter);

Deno.serve(app.fetch);
