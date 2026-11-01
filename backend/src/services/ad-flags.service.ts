import { AdFlag, AdFlagStatus, AdStatus, Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { CreateAdFlagInput, ListAdFlagsQuery, ResolveAdFlagAction } from "../validators/ad-flags.validator";
import { getEffectivePlan } from "./business-plan";

const adFlagWithAdInclude = {
  ad: {
    select: {
      id: true,
      title: true,
      body: true,
      imageUrl: true,
      status: true,
      business: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.AdFlagInclude;

export type AdFlagWithAd = Prisma.AdFlagGetPayload<{ include: typeof adFlagWithAdInclude }>;

// solo se denuncia lo que se está mostrando
export async function create(adId: number, data: CreateAdFlagInput & { userId: number }): Promise<AdFlag> {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    select: { status: true, business: { select: { userId: true, plan: true, planExpiresAt: true } } },
  });
  const servable =
    ad?.status === AdStatus.ACTIVE && getEffectivePlan(ad.business.plan, ad.business.planExpiresAt) === "PREMIUM";
  if (!ad || !servable) {
    throw new AppError(404, "Anuncio no encontrado");
  }
  if (ad.business.userId === data.userId) {
    throw new AppError(403, "No podés denunciar tu propio anuncio");
  }

  try {
    return await prisma.adFlag.create({ data: { adId, userId: data.userId, reason: data.reason } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "Ya denunciaste este anuncio");
    }
    throw error;
  }
}

export async function list(filters: ListAdFlagsQuery = {}): Promise<AdFlagWithAd[]> {
  return prisma.adFlag.findMany({
    where: { status: filters.status ?? AdFlagStatus.pending },
    include: adFlagWithAdInclude,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Escritura condicional, como report-flags.service `resolve`: si dos
 * moderadores resuelven a la vez, solo el primero gana. Dar de baja cierra
 * además las otras denuncias pendientes del mismo anuncio.
 */
export async function resolve(id: number, action: ResolveAdFlagAction): Promise<AdFlagWithAd> {
  const status = action === "remove" ? AdFlagStatus.removed : AdFlagStatus.dismissed;

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.adFlag.updateMany({ where: { id, status: AdFlagStatus.pending }, data: { status } });
    if (count === 0) {
      const current = await tx.adFlag.findUnique({ where: { id } });
      if (!current) {
        throw new AppError(404, "Denuncia no encontrada");
      }
      throw new AppError(409, "Esta denuncia ya fue revisada");
    }

    if (action === "remove") {
      const flag = await tx.adFlag.findUniqueOrThrow({ where: { id } });
      await tx.ad.update({ where: { id: flag.adId }, data: { status: AdStatus.REMOVED } });
      await tx.adFlag.updateMany({
        where: { adId: flag.adId, status: AdFlagStatus.pending },
        data: { status: AdFlagStatus.removed },
      });
    }
  });

  return prisma.adFlag.findUniqueOrThrow({ where: { id }, include: adFlagWithAdInclude });
}
