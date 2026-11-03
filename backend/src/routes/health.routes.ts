import { Router } from "express";
import { prisma } from "../db/client";
import { getAiServiceStatus, pingAiService } from "../config/ai-service";

export const healthRouter = Router();

// Liveness: el proceso responde. No toca la base ni el Backend IA a propósito,
// para que la caída de una dependencia no haga que el orquestador reinicie un
// proceso sano. `ai` solo dice si la variable está configurada (#220).
healthRouter.get("/", (_req, res) => {
  res.status(200).json({ status: "ok", ai: getAiServiceStatus() });
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

// Backend IA: configurado y respondiendo (#220).
healthRouter.get("/ai", async (_req, res) => {
  const status = await pingAiService();
  res.status(status === "ok" ? 200 : 503).json({ status });
});
