import { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import * as notificationPreferencesService from "./notification-preferences.service";

// exportación de datos propios (#366): todo sale por whitelists explícitas

const MESSAGE_NOTIFICATION_TEXT = "Tenés un mensaje nuevo.";

const petSelect = {
  id: true,
  name: true,
  species: true,
  breed: true,
  age: true,
  color: true,
  description: true,
  photoUrls: true,
  microchipId: true,
  createdAt: true,
} satisfies Prisma.PetSelect;

const matchSelect = {
  id: true,
  reportLostId: true,
  reportFoundId: true,
  similarityScore: true,
  status: true,
  createdAt: true,
  confirmedAt: true,
} satisfies Prisma.ReportMatchSelect;

const reportSelect = {
  id: true,
  petId: true,
  reportType: true,
  status: true,
  title: true,
  description: true,
  imageUrl: true,
  extraImageUrls: true,
  customFlyerUrl: true,
  locationAddress: true,
  showPhoneOnFlyer: true,
  eventDate: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  closedReason: true,
  closedAt: true,
  matchesAsLost: { select: matchSelect, orderBy: { id: "asc" } },
  matchesAsFound: { select: matchSelect, orderBy: { id: "asc" } },
} satisfies Prisma.ReportSelect;

// sin actor, motivo interno ni denuncias que la dispararon
const sanctionSelect = { kind: true, status: true, startsAt: true, endsAt: true, createdAt: true } satisfies Prisma.AccountSanctionSelect;

const businessSelect = {
  name: true,
  cuit: true,
  address: true,
  phone: true,
  category: true,
  latitude: true,
  longitude: true,
  description: true,
  website: true,
  socialLinks: true,
  plan: true,
  planExpiresAt: true,
  createdAt: true,
  subscriptions: {
    select: { period: true, amountUsd: true, status: true, periodStart: true, periodEnd: true, createdAt: true },
    orderBy: { id: "asc" },
  },
  ads: {
    select: { id: true, title: true, body: true, imageUrl: true, radiusKm: true, status: true, createdAt: true, updatedAt: true },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.BusinessSelect;

interface LocationRow {
  id: number;
  lat: number;
  lng: number;
}

// ubicación de los reportes propios (geometry fuera del cliente Prisma)
async function reportLocations(userId: number): Promise<Map<number, { lat: number; lng: number }>> {
  const rows = await prisma.$queryRaw<LocationRow[]>`
    SELECT id, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    FROM reports
    WHERE user_id = ${userId} AND location IS NOT NULL
  `;
  return new Map(rows.map((row) => [row.id, { lat: row.lat, lng: row.lng }]));
}

export async function exportAccountData(userId: number) {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, fullName: true, phone: true, role: true, emailVerifiedAt: true, twoFactorEnabledAt: true, createdAt: true },
  });
  if (!account) {
    throw new AppError(404, "Usuario no encontrado");
  }

  const [pets, reports, locations, reportFlags, adFlags, accountReportsMade, sanctions, chats, notifications, notificationPreferences, business] =
    await Promise.all([
      prisma.pet.findMany({ where: { userId }, select: petSelect, orderBy: { id: "asc" } }),
      prisma.report.findMany({ where: { userId }, select: reportSelect, orderBy: { id: "asc" } }),
      reportLocations(userId),
      prisma.reportFlag.findMany({
        where: { userId },
        select: { id: true, reportId: true, reason: true, detail: true, status: true, createdAt: true },
        orderBy: { id: "asc" },
      }),
      prisma.adFlag.findMany({
        where: { userId },
        select: { id: true, adId: true, reason: true, status: true, createdAt: true },
        orderBy: { id: "asc" },
      }),
      prisma.accountReport.findMany({
        where: { reporterId: userId },
        select: { id: true, reportedUserId: true, severity: true, createdAt: true },
        orderBy: { id: "asc" },
      }),
      prisma.accountSanction.findMany({ where: { userId }, select: sanctionSelect, orderBy: { id: "asc" } }),
      // solo los mensajes que mandó el usuario; nada de la otra parte
      prisma.chat.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        select: {
          id: true,
          reportId: true,
          createdAt: true,
          messages: {
            where: { senderId: userId },
            select: { id: true, content: true, imageUrl: true, createdAt: true },
            orderBy: { id: "asc" },
          },
        },
        orderBy: { id: "asc" },
      }),
      prisma.notification.findMany({
        where: { userId },
        select: { id: true, type: true, title: true, message: true, reportId: true, chatId: true, isRead: true, createdAt: true },
        orderBy: { id: "asc" },
      }),
      notificationPreferencesService.get(userId),
      prisma.business.findUnique({ where: { userId }, select: businessSelect }),
    ]);

  return {
    exportedAt: new Date(),
    account: {
      email: account.email,
      fullName: account.fullName,
      phone: account.phone,
      role: account.role,
      emailVerifiedAt: account.emailVerifiedAt,
      twoFactorEnabled: account.twoFactorEnabledAt !== null,
      createdAt: account.createdAt,
    },
    pets,
    reports: reports.map(({ matchesAsLost, matchesAsFound, ...report }) => ({
      ...report,
      location: locations.get(report.id) ?? null,
      matches: [...matchesAsLost, ...matchesAsFound].sort((a, b) => a.id - b.id),
    })),
    reportFlags,
    adFlags,
    accountReportsMade,
    sanctions,
    chats: chats.map(({ messages, ...chat }) => ({ ...chat, messagesSent: messages })),
    // la vista previa de un mensaje es texto de la otra parte
    notifications: notifications.map((n) => (n.type === "message" ? { ...n, message: MESSAGE_NOTIFICATION_TEXT } : n)),
    notificationPreferences,
    business: business
      ? {
          ...business,
          subscriptions: business.subscriptions.map((sub) => ({ ...sub, amountUsd: sub.amountUsd.toString() })),
        }
      : null,
  };
}
