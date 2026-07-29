import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { UploadController } from "./uploadController.ts";
import { authMiddleware } from "../../_shared/authMiddleware.ts";

const uploadRouter = new Hono();
const uploadController = new UploadController();

uploadRouter.use("*", authMiddleware);
uploadRouter.post("/", (c) => uploadController.createUploadUrlV1(c));

export default uploadRouter;
