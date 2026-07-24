import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { OpenaiController } from "./openaiController.ts";
import { authMiddleware } from "../_shared/authMiddleware.ts";

const openaiRouter = new Hono();
const openaiController = new OpenaiController();

openaiRouter.use("*", authMiddleware);
openaiRouter.post("/qt", (c) => openaiController.getQTcontent(c));

export default openaiRouter;
