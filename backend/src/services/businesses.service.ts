import { Business, BusinessEventType, BusinessPlan, Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import {
  CreateBusinessInput,
  ListBusinessesQuery,
  UpdateBusinessInput,
} from "../validators/businesses.validator";

// Proyección pública de un comercio: deja afuera `cuit` y `userId`, que son
// datos del titular y solo se devuelven al dueño por GET /me.
const publicBusinessSelect = {
  id: true,
  name: true,
  address: true,
  phone: true,
  category: true,
  plan: true,
  createdAt: true,
} satisfies Prisma.BusinessSelect;

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function isUniqueConflictOn(error: Prisma.PrismaClientKnownRequestError, column: string): boolean {
  const target = error.meta?.target;
  return Array.isArray(target) && target.includes(column);
}

export interface BusinessStats {
  views: number;
  contacts: number;
}

export type PublicBusiness = Prisma.BusinessGetPayload<{ select: typeof publicBusinessSelect }>;

export async function create(data: CreateBusinessInput & { userId: number }): Promise<Business> {
  try {
    return await prisma.business.create({ data });
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      const prismaError = error as Prisma.PrismaClientKnownRequestError;
      if (isUniqueConflictOn(prismaError, "cuit")) {
        throw new AppError(409, "El CUIT ya está registrado");
      }
      throw new AppError(409, "El usuario ya tiene un comercio registrado");
    }
    if (isPrismaKnownError(error, "P2003")) {
      throw new AppError(400, "userId no corresponde a un usuario existente");
    }
    throw error;
  }
}

export async function getByUserId(userId: number): Promise<Business> {
  const business = await prisma.business.findUnique({ where: { userId } });
  if (!business) {
    throw new AppError(404, "Comercio no encontrado");
  }
  return business;
}

/**
 * Datos que acepta el servicio al actualizar un comercio.
 *
 * Es a propósito más amplio que `UpdateBusinessInput`, que es lo que acepta la
 * API: el validador HTTP no deja pasar `plan` para que nadie se auto-otorgue
 * PREMIUM (ver `businesses.validator.ts`). El servicio sí lo soporta, porque es
 * el punto por donde va a entrar el futuro flujo de pago, que no pasa por el
 * body de una request del dueño.
 */
export type UpdateBusinessData = UpdateBusinessInput & { plan?: BusinessPlan };

export async function updateByUserId(userId: number, data: UpdateBusinessData): Promise<Business> {
  await getByUserId(userId);

  try {
    return await prisma.business.update({ where: { userId }, data });
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      throw new AppError(409, "El CUIT ya está registrado");
    }
    throw error;
  }
}

export async function listPublic(filters: ListBusinessesQuery): Promise<PublicBusiness[]> {
  return prisma.business.findMany({
    where: filters.category ? { category: filters.category } : undefined,
    select: publicBusinessSelect,
    orderBy: { name: "asc" },
  });
}

export async function getPublicById(id: number): Promise<PublicBusiness> {
  const business = await prisma.business.findUnique({ where: { id }, select: publicBusinessSelect });
  if (!business) {
    throw new AppError(404, "Comercio no encontrado");
  }
  return business;
}

async function getOwnerIdOrThrow(businessId: number): Promise<number> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { userId: true },
  });
  if (!business) {
    throw new AppError(404, "Comercio no encontrado");
  }
  return business.userId;
}

/**
 * Registra una visita al perfil público del comercio.
 *
 * Las visitas del propio dueño se descartan en silencio: son un efecto
 * secundario de que el comercio revise su ficha, no interés real, y contarlas
 * inflaría la métrica que después muestra su dashboard.
 */
export async function recordView(businessId: number, viewerUserId?: number): Promise<void> {
  const ownerId = await getOwnerIdOrThrow(businessId);
  if (viewerUserId !== undefined && viewerUserId === ownerId) {
    return;
  }

  await prisma.businessEvent.create({
    data: { businessId, type: BusinessEventType.VIEW, userId: viewerUserId ?? null },
  });
}

/**
 * Registra un contacto hacia el comercio. A diferencia de la vista, contactarse
 * es una acción explícita: si el dueño la dispara sobre su propio comercio se
 * responde 400 en vez de ignorarla, para que el error sea visible.
 */
export async function recordContact(businessId: number, userId: number): Promise<void> {
  const ownerId = await getOwnerIdOrThrow(businessId);
  if (userId === ownerId) {
    throw new AppError(400, "No podés contactar a tu propio comercio");
  }

  await prisma.businessEvent.create({
    data: { businessId, type: BusinessEventType.CONTACT, userId },
  });
}

/**
 * Métricas del dashboard, agregadas sobre los eventos realmente persistidos en
 * `business_events`. Un comercio sin interacciones devuelve ceros porque no
 * ocurrió nada, no porque el dato falte.
 */
export async function getStats(userId: number): Promise<BusinessStats> {
  const business = await getByUserId(userId);

  const grouped = await prisma.businessEvent.groupBy({
    by: ["type"],
    where: { businessId: business.id },
    _count: { _all: true },
  });

  const countOf = (type: BusinessEventType): number =>
    grouped.find((row) => row.type === type)?._count._all ?? 0;

  return {
    views: countOf(BusinessEventType.VIEW),
    contacts: countOf(BusinessEventType.CONTACT),
  };
}
