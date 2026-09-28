import { Router } from "express";
import * as businessesController from "../controllers/businesses.controller";
import { optionalAuth, requireAuth, requireVerifiedEmail } from "../middlewares/auth.middleware";

export const businessesRouter = Router();

// Las rutas /me* van antes que /:id: si no, Express captura "me" como id.
// Registrar un comercio es lo único de este router que exige el email verificado.
businessesRouter.post("/", requireAuth, requireVerifiedEmail, businessesController.create);
businessesRouter.get("/me", requireAuth, businessesController.getMe);
businessesRouter.put("/me", requireAuth, businessesController.updateMe);
businessesRouter.get("/me/stats", requireAuth, businessesController.getStats);

businessesRouter.get("/", businessesController.list);
businessesRouter.get("/:id", optionalAuth, businessesController.getById);
businessesRouter.post("/:id/contact", requireAuth, businessesController.contact);
