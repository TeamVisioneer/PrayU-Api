import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { OpenaiController } from "./openaiController.ts";
import { authMiddleware } from "../_shared/authMiddleware.ts";

const openaiRouter = new Hono();
const openaiController = new OpenaiController();

openaiRouter.use("*", authMiddleware);
openaiRouter.post("/bible-verse", (c) => openaiController.getBibleMessage(c));
openaiRouter.post("/bible-image", (c) => openaiController.getNatureImage(c));

export default openaiRouter;
