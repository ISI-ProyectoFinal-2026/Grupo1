import { Business, BusinessEventType, Prisma, Subscription, SubscriptionPeriod } from "@prisma/client";
import { getPlanOffers, PERIOD_MONTHS } from "../config/plans";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import {
  CreateBusinessInput,
  ListBusinessesQuery,
  UpdateBusinessInput,
} from "../validators/businesses.validator";
import { addMonths, getEffectivePlan, planPeriodStart } from "./business-plan";
import { getPaymentProvider, PaymentProvider } from "./payments";

// Proyección pública de un comercio: deja afuera `cuit` y `userId`, que son
// datos del titular y solo se devuelven al dueño por GET /me.
const publicBusinessSelect = {
  id: true,
  name: true,
  address: true,
  phone: true,
  category: true,
  description: true,
  website: true,
  socialLinks: true,
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

// el vencimiento se lee para calcular el plan vigente, pero no se publica
const publicBusinessWithExpirySelect = { ...publicBusinessSelect, planExpiresAt: true } satisfies Prisma.BusinessSelect;

type PublicBusinessWithExpiry = Prisma.BusinessGetPayload<{ select: typeof publicBusinessWithExpirySelect }>;

function withEffectivePlan(business: Business): Business {
  return { ...business, plan: getEffectivePlan(business.plan, business.planExpiresAt) };
}

function toPublicBusiness({ planExpiresAt, ...business }: PublicBusinessWithExpiry): PublicBusiness {
  return { ...business, plan: getEffectivePlan(business.plan, planExpiresAt) };
}

// location de la API -> columnas latitude/longitude
function toCoordinates(location: { lat: number; lng: number }) {
  return { latitude: location.lat, longitude: location.lng };
}

export async function create(data: CreateBusinessInput & { userId: number }): Promise<Business> {
  // Campos explícitos en vez de pasar `data` entero: si un caller cuela `plan`
  // (u otra columna) igual no llega a Prisma. Todo comercio nace FREE.
  const { userId, name, cuit, address, phone, category, location, description, website, socialLinks } = data;
  try {
    return await prisma.business.create({
      data: {
        userId,
        name,
        cuit,
        address,
        phone,
        category,
        description,
        website,
        socialLinks,
        ...toCoordinates(location),
      },
    });
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
  return withEffectivePlan(business);
}

// El plan no se edita: solo cambia con subscribe()
export async function updateByUserId(userId: number, data: UpdateBusinessInput): Promise<Business> {
  await getByUserId(userId);
  const { location, ...fields } = data;

  try {
    const business = await prisma.business.update({
      where: { userId },
      data: { ...fields, ...(location && toCoordinates(location)) },
    });
    return withEffectivePlan(business);
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      throw new AppError(409, "El CUIT ya está registrado");
    }
    throw error;
  }
}

export async function listPublic(filters: ListBusinessesQuery): Promise<PublicBusiness[]> {
  const businesses = await prisma.business.findMany({
    where: filters.category ? { category: filters.category } : undefined,
    select: publicBusinessWithExpirySelect,
    orderBy: { name: "asc" },
  });
  // Premium vigente primero (destacados); sort estable conserva el orden por nombre
  return businesses
    .map(toPublicBusiness)
    .sort((a, b) => Number(b.plan === "PREMIUM") - Number(a.plan === "PREMIUM"));
}

export async function getPublicById(id: number): Promise<PublicBusiness> {
  const business = await prisma.business.findUnique({ where: { id }, select: publicBusinessWithExpirySelect });
  if (!business) {
    throw new AppError(404, "Comercio no encontrado");
  }
  return toPublicBusiness(business);
}

export interface SubscribeResult {
  business: Business;
  // el monto viaja como número, igual que priceUsd en GET /plans
  subscription: Omit<Subscription, "amountUsd"> & { amountUsd: number };
}

// cobro fuera de la transacción; vencimiento recalculado con la fila bloqueada (renovaciones simultáneas)
export async function subscribe(
  userId: number,
  period: SubscriptionPeriod,
  provider: PaymentProvider = getPaymentProvider()
): Promise<SubscribeResult> {
  const business = await getByUserId(userId);
  const offer = getPlanOffers().find((item) => item.period === period)!;
  const charge = await provider.charge({
    businessId: business.id,
    amountUsd: offer.priceUsd,
    description: `PATITAS Premium ${period}`,
  });
  const payment = { businessId: business.id, period, amountUsd: offer.priceUsd, provider: charge.provider, reference: charge.reference };

  if (charge.status === "REJECTED") {
    await prisma.subscription.create({ data: { ...payment, status: "REJECTED" } });
    throw new AppError(402, "El pago fue rechazado", undefined, "PAYMENT_REJECTED");
  }

  return prisma.$transaction(async (tx) => {
    // bloquea la fila del comercio hasta el final de la transacción
    await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${business.id} FOR UPDATE`;
    const current = await tx.business.findUniqueOrThrow({ where: { id: business.id } });
    const now = new Date();
    const periodStart = planPeriodStart(current.plan, current.planExpiresAt, now);
    const periodEnd = addMonths(periodStart, PERIOD_MONTHS[period]);

    const subscription = await tx.subscription.create({
      data: { ...payment, status: "APPROVED", periodStart, periodEnd },
    });
    const updated = await tx.business.update({
      where: { id: business.id },
      data: { plan: "PREMIUM", planExpiresAt: periodEnd },
    });
    return { business: withEffectivePlan(updated), subscription: { ...subscription, amountUsd: Number(subscription.amountUsd) } };
  });
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
