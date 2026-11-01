import { Ad, AdStatus, Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { CreateAdInput, UpdateAdInput } from "../validators/ads.validator";
import { getEffectivePlan } from "./business-plan";
import * as businessesService from "./businesses.service";

// máximo de anuncios activos por comercio (ADR-0024)
export const MAX_ACTIVE_ADS = 3;

type Tx = Prisma.TransactionClient;

// 404 también si el anuncio es de otro comercio: no revela que existe
export async function getOwnAd(userId: number, adId: number): Promise<Ad> {
  const business = await businessesService.getByUserId(userId);
  const ad = await prisma.ad.findFirst({ where: { id: adId, businessId: business.id } });
  if (!ad) {
    throw new AppError(404, "Anuncio no encontrado");
  }
  return ad;
}

function assertNotRemoved(ad: Ad): void {
  if (ad.status === AdStatus.REMOVED) {
    throw new AppError(409, "El anuncio fue dado de baja por moderación", undefined, "AD_REMOVED");
  }
}

/**
 * Bloquea la fila del comercio y valida que pueda tener un anuncio activo más:
 * Premium vigente, ubicación cargada y menos de MAX_ACTIVE_ADS activos. El lock
 * serializa altas y reactivaciones simultáneas para que el límite no se pase.
 */
async function assertCanActivate(tx: Tx, businessId: number): Promise<void> {
  await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${businessId} FOR UPDATE`;
  const business = await tx.business.findUniqueOrThrow({ where: { id: businessId } });

  if (getEffectivePlan(business.plan, business.planExpiresAt) !== "PREMIUM") {
    throw new AppError(403, "Solo el plan Premium permite publicar anuncios", undefined, "PREMIUM_REQUIRED");
  }
  if (business.latitude === null || business.longitude === null) {
    throw new AppError(
      409,
      "Cargá la ubicación del comercio en el mapa para publicar anuncios",
      undefined,
      "BUSINESS_LOCATION_REQUIRED"
    );
  }
  const active = await tx.ad.count({ where: { businessId, status: AdStatus.ACTIVE } });
  if (active >= MAX_ACTIVE_ADS) {
    throw new AppError(409, `Podés tener hasta ${MAX_ACTIVE_ADS} anuncios activos`, undefined, "AD_LIMIT_REACHED");
  }
}

export async function listOwn(userId: number): Promise<Ad[]> {
  const business = await businessesService.getByUserId(userId);
  return prisma.ad.findMany({ where: { businessId: business.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
}

export async function create(userId: number, data: CreateAdInput): Promise<Ad> {
  const business = await businessesService.getByUserId(userId);
  return prisma.$transaction(async (tx) => {
    await assertCanActivate(tx, business.id);
    return tx.ad.create({ data: { ...data, businessId: business.id, status: AdStatus.ACTIVE } });
  });
}

export async function update(userId: number, adId: number, data: UpdateAdInput): Promise<Ad> {
  const ad = await getOwnAd(userId, adId);
  assertNotRemoved(ad);
  return prisma.ad.update({ where: { id: ad.id }, data });
}

export async function setStatus(userId: number, adId: number, status: "ACTIVE" | "PAUSED"): Promise<Ad> {
  const ad = await getOwnAd(userId, adId);
  assertNotRemoved(ad);
  if (ad.status === status) {
    return ad;
  }
  if (status === AdStatus.PAUSED) {
    return prisma.ad.update({ where: { id: ad.id }, data: { status } });
  }
  return prisma.$transaction(async (tx) => {
    await assertCanActivate(tx, ad.businessId);
    return tx.ad.update({ where: { id: ad.id }, data: { status } });
  });
}

export async function remove(userId: number, adId: number): Promise<void> {
  const ad = await getOwnAd(userId, adId);
  await prisma.ad.delete({ where: { id: ad.id } });
}
