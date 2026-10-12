import { Router } from "express";
import { prisma } from "../db/client";

export const healthRouter = Router();

// Liveness: el proceso responde. No toca la base a propósito, para que una
// caída de Postgres no haga que el orquestador reinicie un proceso sano.
healthRouter.get("/", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Readiness: el proceso puede atender requests reales porque la base contesta.
healthRouter.get("/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
