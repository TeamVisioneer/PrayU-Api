import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { OnesignalController } from "./onesignalController.ts";
import { authMiddleware } from "../_shared/authMiddleware.ts";

const app = new Hono();
const onesignalRouter = new Hono();
const onesignalController = new OnesignalController();

onesignalRouter.use("*", authMiddleware);
onesignalRouter.post(
  "/notifications",
  (c) => onesignalController.sendNotification(c),
);
onesignalRouter.patch(
  "/users",
  (c) => onesignalController.updateUser(c),
);

app.basePath("/onesignal")
  .route("/", onesignalRouter);

Deno.serve(app.fetch);
