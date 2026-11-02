import { Router } from "express";
import { getPlanOffers } from "../config/plans";

export const plansRouter = Router();

// precios públicos de Premium
plansRouter.get("/", (_req, res) => {
  res.status(200).json(getPlanOffers());
});
