import { Router } from "express";
import * as uploadsController from "../controllers/uploads.controller";

export const uploadsRouter = Router();

uploadsRouter.post("/presign", uploadsController.presign);
