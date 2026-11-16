import { Prisma, ReportFlag, ReportFlagStatus } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import {
  CreateReportFlagInput,
  ListReportFlagsQuery,
  ResolveReportFlagAction,
} from "../validators/report-flags.validator";
import * as notificationsService from "./notifications.service";
import { getReportFlagThreshold } from "../config/report-flags";

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

const reportFlagWithReportInclude = {
  report: { select: { id: true, title: true, status: true } },
} satisfies Prisma.ReportFlagInclude;

export type ReportFlagWithReport = Prisma.ReportFlagGetPayload<{ include: typeof reportFlagWithReportInclude }>;

const ALREADY_FLAGGED_MESSAGE = "Ya reportaste esta publicación";

// notificación posterior al commit: si falla, el estado ya quedó guardado
async function notifyOwner(reportId: number, change: notificationsService.StatusChange): Promise<void> {
  try {
    await notificationsService.createForStatusChange(reportId, change);
  } catch (error) {
    console.error(`[report-flags] no se pudo avisar al dueño (${change}) del report ${reportId}:`, error);
  }
}

// el bloqueo de fila serializa denuncias y acciones de moderación sobre el mismo reporte
async function lockReport(tx: Prisma.TransactionClient, reportId: number): Promise<void> {
  const rows = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM reports WHERE id = ${reportId} FOR UPDATE`;
  if (!rows[0]) {
    throw new AppError(404, "Reporte no encontrado");
  }
}

export async function create(reportId: number, data: CreateReportFlagInput & { userId: number }): Promise<ReportFlag> {
  const { flag, hidden } = await prisma
    .$transaction(async (tx) => {
      await lockReport(tx, reportId);
      const report = await tx.report.findUniqueOrThrow({ where: { id: reportId } });
      // Solo se denuncia lo que está activo en el feed: pending, rejected, hidden
      // y resolved no están visibles o ya salieron de circulación.
      if (report.status !== "published") {
        throw new AppError(404, "Reporte no encontrado");
      }
      if (report.userId === data.userId) {
        throw new AppError(403, "No podés denunciar tu propia publicación");
      }

      const mine = await tx.reportFlag.findFirst({
        where: { reportId, userId: data.userId },
        orderBy: { cycle: "desc" },
      });
      if (mine) {
        // ciclo abierto: una denuncia por usuario; ciclos anteriores: solo si el autor editó después de cerrarlo
        const closedAt = mine.resolvedAt ?? mine.createdAt;
        const editedSince = report.contentEditedAt !== null && report.contentEditedAt > closedAt;
        if (mine.cycle === report.flagCycle || !editedSince) {
          throw new AppError(409, ALREADY_FLAGGED_MESSAGE);
        }
      }

      const flag = await tx.reportFlag.create({
        data: {
          reportId,
          userId: data.userId,
          reason: data.reason,
          detail: data.detail ?? null,
          cycle: report.flagCycle,
        },
      });

      const pending = await tx.reportFlag.count({
        where: { reportId, cycle: report.flagCycle, status: ReportFlagStatus.pending },
      });
      let hidden = false;
      if (pending >= getReportFlagThreshold()) {
        const { count } = await tx.report.updateMany({
          where: { id: reportId, status: "published" },
          data: { status: "hidden" },
        });
        hidden = count === 1;
      }
      return { flag, hidden };
    })
    .catch((error: unknown) => {
      if (isPrismaKnownError(error, "P2002")) {
        throw new AppError(409, ALREADY_FLAGGED_MESSAGE);
      }
      if (isPrismaKnownError(error, "P2003")) {
        throw new AppError(400, "userId no corresponde a un usuario existente");
      }
      throw error;
    });

  if (hidden) {
    await notifyOwner(reportId, "auto_hidden");
  }
  return flag;
}

/**
 * Cola de moderación: por defecto solo los flags pendientes, que es lo que
 * un moderador necesita revisar (mismo criterio que reports.service.ts
 * `list()`, que por defecto solo muestra `published`).
 */
export async function list(filters: ListReportFlagsQuery = {}): Promise<ReportFlagWithReport[]> {
  const status = filters.status ?? ReportFlagStatus.pending;
  return prisma.reportFlag.findMany({
    where: { status },
    include: reportFlagWithReportInclude,
    orderBy: { createdAt: "desc" },
  });
}

// escritura condicional: con dos moderadores a la vez gana el primero; aceptar oculta el reporte (las demás denuncias siguen pendientes) y avisa al autor
export async function resolve(id: number, action: ResolveReportFlagAction): Promise<ReportFlagWithReport> {
  const status = action === "accept" ? ReportFlagStatus.reviewed : ReportFlagStatus.dismissed;

  const hiddenReportId = await prisma.$transaction(async (tx) => {
    const { count } = await tx.reportFlag.updateMany({
      where: { id, status: ReportFlagStatus.pending },
      data: { status, resolvedAt: new Date() },
    });

    if (count === 0) {
      const current = await tx.reportFlag.findUnique({ where: { id } });
      if (!current) {
        throw new AppError(404, "Reporte de moderación no encontrado");
      }
      throw new AppError(409, "Este reporte de moderación ya fue revisado");
    }

    if (action === "dismiss") {
      return null;
    }

    const flag = await tx.reportFlag.findUniqueOrThrow({ where: { id } });
    const { count: hidden } = await tx.report.updateMany({
      where: { id: flag.reportId, status: "published" },
      data: { status: "hidden" },
    });
    return hidden === 1 ? flag.reportId : null;
  });

  if (hiddenReportId !== null) {
    await notifyOwner(hiddenReportId, "hidden_by_flag");
  }

  return prisma.reportFlag.findUniqueOrThrow({ where: { id }, include: reportFlagWithReportInclude });
}
