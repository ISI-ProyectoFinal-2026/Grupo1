import { Prisma, ReportFlag } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { CreateReportFlagInput } from "../validators/report-flags.validator";

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

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
