import { Router } from "express";
import * as petsController from "../controllers/pets.controller";

export const petsRouter = Router();

petsRouter.get("/", petsController.list);
petsRouter.post("/", petsController.create);
petsRouter.get("/:id", petsController.getById);
petsRouter.put("/:id", petsController.update);
petsRouter.delete("/:id", petsController.remove);
