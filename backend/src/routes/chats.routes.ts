import { Router } from "express";
import * as chatsController from "../controllers/chats.controller";
import { requireAuth, requireVerifiedEmail } from "../middlewares/auth.middleware";

export const chatsRouter = Router();

chatsRouter.get("/", requireAuth, chatsController.list);
chatsRouter.post("/", requireAuth, requireVerifiedEmail, chatsController.create);
chatsRouter.get("/:id/messages", requireAuth, chatsController.getMessages);
chatsRouter.post("/:id/messages", requireAuth, requireVerifiedEmail, chatsController.sendMessage);
