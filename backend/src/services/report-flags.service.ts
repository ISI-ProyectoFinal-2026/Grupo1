import { Prisma, ReportFlag, ReportFlagReason, ReportFlagStatus, ReportType, ReportStatus } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import {
  CreateReportFlagInput,
  ListReportFlagsQuery,
  ModerationAction,
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

export type ReportFlagGroupDTO = {
  report: {
    id: number;
    title: string;
    status: ReportStatus;
    reportType: ReportType;
    imageUrl: string | null;
    description: string | null;
  };
  flagCount: number;
  reasonCounts: Partial<Record<ReportFlagReason, number>>;
  otherDetails: string[];
  lastFlaggedAt: string;
};

// cola agrupada: ocultos primero, luego más denunciados y más recientes; los confirmados no tienen pendientes y salen
export async function listGroups(): Promise<ReportFlagGroupDTO[]> {
  const flags = await prisma.reportFlag.findMany({
    where: { status: ReportFlagStatus.pending, report: { status: { in: ["published", "hidden"] } } },
    include: {
      report: { select: { id: true, title: true, status: true, reportType: true, imageUrl: true, description: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<number, ReportFlagGroupDTO>();
  for (const flag of flags) {
    const group = groups.get(flag.reportId) ?? {
      report: flag.report,
      flagCount: 0,
      reasonCounts: {},
      otherDetails: [],
      lastFlaggedAt: flag.createdAt.toISOString(),
    };
    group.flagCount += 1;
    group.reasonCounts[flag.reason] = (group.reasonCounts[flag.reason] ?? 0) + 1;
    if (flag.reason === ReportFlagReason.other && flag.detail) {
      group.otherDetails.push(flag.detail);
    }
    group.lastFlaggedAt = flag.createdAt.toISOString();
    groups.set(flag.reportId, group);
  }

  return [...groups.values()].sort(
    (a, b) =>
      Number(b.report.status === "hidden") - Number(a.report.status === "hidden") ||
      b.flagCount - a.flagCount ||
      b.lastFlaggedAt.localeCompare(a.lastFlaggedAt)
  );
}

const ALREADY_REVIEWED_MESSAGE = "Este reporte ya fue revisado";

const ACTION_NOTICE = {
  hide: "hidden_by_flag",
  restore: "restored",
  confirm: "hide_confirmed",
} as const;

// acciones por reporte: el bloqueo de fila + la precondición hacen que gane un solo moderador
export async function moderate(reportId: number, action: ModerationAction): Promise<{ id: number; status: ReportStatus }> {
  const status = await prisma.$transaction(async (tx) => {
    await lockReport(tx, reportId);
    const report = await tx.report.findUniqueOrThrow({ where: { id: reportId } });
    const pending = await tx.reportFlag.count({ where: { reportId, status: ReportFlagStatus.pending } });
    const closeFlags = (to: ReportFlagStatus) =>
      tx.reportFlag.updateMany({
        where: { reportId, status: ReportFlagStatus.pending },
        data: { status: to, resolvedAt: new Date() },
      });

    const needsPending = action !== "restore";
    const requiredStatus = action === "hide" || action === "dismiss" ? "published" : "hidden";
    if (report.status !== requiredStatus || (needsPending && pending === 0)) {
      throw new AppError(409, ALREADY_REVIEWED_MESSAGE);
    }

    if (action === "hide") {
      await tx.report.update({ where: { id: reportId }, data: { status: "hidden" } });
      return "hidden" as const;
    }
    if (action === "confirm") {
      await closeFlags(ReportFlagStatus.reviewed);
      return "hidden" as const;
    }
    // restaurar solo si el ocultamiento no fue confirmado: confirmar deja una denuncia reviewed en el ciclo
    if (action === "restore") {
      const confirmed = await tx.reportFlag.count({
        where: { reportId, cycle: report.flagCycle, status: ReportFlagStatus.reviewed },
      });
      if (confirmed > 0) {
        throw new AppError(409, "El ocultamiento ya fue confirmado");
      }
    }
    await closeFlags(ReportFlagStatus.dismissed);
    await tx.report.update({
      where: { id: reportId },
      data: { flagCycle: { increment: 1 }, ...(action === "restore" ? { status: "published" } : {}) },
    });
    return "published" as const;
  });

  if (action !== "dismiss") {
    await notifyOwner(reportId, ACTION_NOTICE[action]);
  }
  return { id: reportId, status };
}
