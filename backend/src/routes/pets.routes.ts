import { Router } from "express";
import * as petsController from "../controllers/pets.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const petsRouter = Router();

petsRouter.get("/", petsController.list);
petsRouter.post("/", requireAuth, petsController.create);
petsRouter.get("/:id", petsController.getById);
petsRouter.put("/:id", requireAuth, petsController.update);
petsRouter.delete("/:id", requireAuth, petsController.remove);
