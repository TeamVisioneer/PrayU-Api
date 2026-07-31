import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { AdminController } from "./adminController.ts";
import { authMiddleware } from "../../_shared/authMiddleware.ts";

const adminRouter = new Hono();
const adminController = new AdminController();

adminRouter.use("*", authMiddleware);
adminRouter.post("/premium", (c) => adminController.setPremiumExpiryV1(c));

export default adminRouter;
