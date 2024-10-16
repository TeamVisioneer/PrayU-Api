import { UserController } from "../controllers/userController.ts";
import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { authMiddleware } from "../middleware/authMiddleware.ts";

const userRouter = new Hono();
const userController = new UserController();

userRouter.use(authMiddleware);

userRouter.post(
  "/v1/fcmToken",
  (c) => userController.postFCMTokenV1(c),
);

userRouter.get(
  "/v1/fcmToken",
  (c) => userController.getFCMTokensV1(c),
);

userRouter.delete(
  "/v1/fcmToken",
  (c) => userController.deleteFCMTokenV1(c),
);

userRouter.delete(
  "v1/user",
  (c) => userController.deleteUserV1(c),
);

userRouter.delete();

export default userRouter;
