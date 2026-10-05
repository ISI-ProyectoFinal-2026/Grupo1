import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "../../../src/app";
import { prisma } from "../../../src/db/client";

export interface E2EUser {
  id: number;
  token: string;
  email: string;
}

// Cumple las reglas de registerSchema (mayúscula, minúscula, número, 8+).
export const E2E_PASSWORD = "Patitas123";

/**
 * Registra y loguea un usuario a través de los endpoints reales de /api/auth.
 * El email es único por corrida para que las suites no choquen entre sí ni con
 * datos que hayan quedado de una corrida anterior.
 */
export async function registerAndLogin(label: string): Promise<E2EUser> {
  const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  const register = await request(app).post("/api/auth/register").send({ email, password: E2E_PASSWORD });
  if (register.status !== 201) {
    throw new Error(`register falló (${register.status}): ${JSON.stringify(register.body)}`);
  }

  const login = await request(app).post("/api/auth/login").send({ email, password: E2E_PASSWORD });
  if (login.status !== 200) {
    throw new Error(`login falló (${login.status}): ${JSON.stringify(login.body)}`);
  }

  return { id: login.body.user.id, token: login.body.token, email };
}

/**
 * Cambia el rol directo en la base: no hay endpoint para eso y requireRole lee
 * el rol de la base en cada request, así que el token existente sirve igual.
 */
export async function promoteTo(userId: number, role: Role): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { role } });
}

/**
 * Borra todo lo que tocó la suite respetando las FKs (ninguna relación del
 * schema tiene cascade salvo business_events). Se borra por usuario y por
 * reporte para cubrir también filas creadas por OTROS usuarios sobre reportes
 * de la suite (flags, matches, notificaciones, chats).
 */
export async function cleanupE2EData(userIds: number[], extraReportIds: number[] = []): Promise<void> {
  if (userIds.length === 0 && extraReportIds.length === 0) return;

  const ownedReports = await prisma.report.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const reportIds = [...new Set([...ownedReports.map((r) => r.id), ...extraReportIds])];

  const chats = await prisma.chat.findMany({
    where: { OR: [{ userAId: { in: userIds } }, { userBId: { in: userIds } }, { reportId: { in: reportIds } }] },
    select: { id: true },
  });
  const chatIds = chats.map((c) => c.id);

  await prisma.notification.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { reportId: { in: reportIds } }] },
  });
  await prisma.reportMatch.deleteMany({
    where: { OR: [{ reportLostId: { in: reportIds } }, { reportFoundId: { in: reportIds } }] },
  });
  await prisma.reportFlag.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { reportId: { in: reportIds } }] },
  });
  await prisma.message.deleteMany({ where: { OR: [{ chatId: { in: chatIds } }, { senderId: { in: userIds } }] } });
  await prisma.chat.deleteMany({ where: { id: { in: chatIds } } });
  await prisma.reportEmbedding.deleteMany({ where: { reportId: { in: reportIds } } });
  await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
  await prisma.pet.deleteMany({ where: { userId: { in: userIds } } });
  // business_events cae en cascada con el business.
  await prisma.business.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

/**
 * Lleva la cuenta de lo que crea una suite para poder limpiarlo en afterAll.
 */
export function createE2EContext(suite: string) {
  const userIds: number[] = [];
  const reportIds: number[] = [];

  return {
    async registerAndLogin(label: string): Promise<E2EUser> {
      const user = await registerAndLogin(`${suite}-${label}`);
      userIds.push(user.id);
      return user;
    },
    trackReport(reportId: number): void {
      reportIds.push(reportId);
    },
    cleanup(): Promise<void> {
      return cleanupE2EData(userIds, reportIds);
    },
  };
}
