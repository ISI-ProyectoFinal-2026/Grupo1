import { Router } from "express";
import * as chatsController from "../controllers/chats.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const chatsRouter = Router();

chatsRouter.get("/", requireAuth, chatsController.list);
chatsRouter.post("/", requireAuth, chatsController.create);
chatsRouter.get("/:id/messages", requireAuth, chatsController.getMessages);
chatsRouter.post("/:id/messages", requireAuth, chatsController.sendMessage);
