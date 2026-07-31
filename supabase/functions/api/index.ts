import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import userRouter from "./users/userRouter.ts";
import churchRouter from "./churches/churchRouter.ts";
import uploadRouter from "./upload/uploadRouter.ts";
import adminRouter from "./admin/adminRouter.ts";

const app = new Hono();

app.basePath("/api")
  .route("/users", userRouter)
  .route("/churches", churchRouter)
  .route("/upload-url", uploadRouter)
  .route("/admin", adminRouter);

Deno.serve(app.fetch);
