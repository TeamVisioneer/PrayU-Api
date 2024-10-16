import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { UserController } from "./userController.ts";
import { authMiddleware } from "./authMiddleware.ts";

const userRouter = new Hono();
const userController = new UserController();

userRouter.use(authMiddleware);

userRouter.post("/", (c) => userController.createUserV1(c));

userRouter.delete("/", (c) => userController.deleteUserV1(c));

Deno.serve(userRouter.fetch);
