import { Prisma, ReportFlag, ReportFlagStatus } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { CreateReportFlagInput, ListReportFlagsQuery } from "../validators/report-flags.validator";

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

const reportFlagWithReportInclude = {
  report: { select: { id: true, title: true, status: true } },
} satisfies Prisma.ReportFlagInclude;

export type ReportFlagWithReport = Prisma.ReportFlagGetPayload<{ include: typeof reportFlagWithReportInclude }>;

export async function create(reportId: number, data: CreateReportFlagInput & { userId: number }): Promise<ReportFlag> {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new AppError(404, "Reporte no encontrado");
  }

  try {
    return await prisma.reportFlag.create({
      data: {
        reportId,
        userId: data.userId,
        reason: data.reason,
      },
    });
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      throw new AppError(409, "Ya reportaste esta publicación");
    }
    if (isPrismaKnownError(error, "P2003")) {
      throw new AppError(400, "userId no corresponde a un usuario existente");
    }
    throw error;
  }
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

/**
 * Resuelve un flag: lo marca "reviewed" y rechaza (oculta) el reporte
 * asociado, en una única operación atómica. Escritura condicional al estilo
 * de matching.service.ts `decideMatch`: si dos moderadores resuelven el
 * mismo flag a la vez, solo el primero gana.
 */
export async function resolve(id: number): Promise<ReportFlagWithReport> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.reportFlag.updateMany({
      where: { id, status: ReportFlagStatus.pending },
      data: { status: ReportFlagStatus.reviewed },
    });

    if (count === 0) {
      const current = await tx.reportFlag.findUnique({ where: { id } });
      if (!current) {
        throw new AppError(404, "Reporte de moderación no encontrado");
      }
      throw new AppError(409, "Este reporte de moderación ya fue revisado");
    }

    const flag = await tx.reportFlag.findUniqueOrThrow({ where: { id } });
    await tx.report.update({ where: { id: flag.reportId }, data: { status: "rejected" } });
  });

  return prisma.reportFlag.findUniqueOrThrow({ where: { id }, include: reportFlagWithReportInclude });
}
