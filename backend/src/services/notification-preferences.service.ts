import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import type { LocationInput, UpdatePreferencesInput } from "../validators/notification-preferences.validator";

export interface NotificationPreferencesDTO {
  notifyMatch: boolean;
  notifyMessage: boolean;
  notifyStatusChange: boolean;
  notifyNearby: boolean;
  nearbyRadiusKm: number;
  nearbyReportType: "lost" | "found" | "both";
  locationConsentStatus: "accepted" | "declined" | null;
  locationConsentAt: Date | null;
  location: { latitude: number; longitude: number; updatedAt: Date } | null;
}

interface LocationRow {
  latitude: number;
  longitude: number;
}

const CONSENT_REQUIRED_MESSAGE = "Activá la ubicación para recibir avisos de tu zona";

export async function get(userId: number): Promise<NotificationPreferencesDTO> {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });

  let location: NotificationPreferencesDTO["location"] = null;
  if (row?.locationUpdatedAt) {
    // location no se accede con el cliente Prisma
    const rows = await prisma.$queryRaw<LocationRow[]>`
      SELECT ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude
      FROM notification_preferences
      WHERE user_id = ${userId} AND location IS NOT NULL
    `;
    if (rows[0]) {
      location = { latitude: rows[0].latitude, longitude: rows[0].longitude, updatedAt: row.locationUpdatedAt };
    }
  }

  return {
    notifyMatch: row?.notifyMatch ?? true,
    notifyMessage: row?.notifyMessage ?? true,
    notifyStatusChange: row?.notifyStatusChange ?? true,
    notifyNearby: row?.notifyNearby ?? true,
    nearbyRadiusKm: row?.nearbyRadiusKm ?? 5,
    nearbyReportType: row?.nearbyReportType ?? "both",
    locationConsentStatus: row?.locationConsentStatus ?? null,
    locationConsentAt: row?.locationConsentAt ?? null,
    location,
  };
}

export async function update(userId: number, data: UpdatePreferencesInput): Promise<NotificationPreferencesDTO> {
  const current = await get(userId);
  const notifyNearby = data.notifyNearby ?? current.notifyNearby;
  if (notifyNearby && current.locationConsentStatus !== "accepted") {
    throw new AppError(409, CONSENT_REQUIRED_MESSAGE);
  }

  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return get(userId);
}

export async function setLocationConsent(
  userId: number,
  status: "accepted" | "declined"
): Promise<NotificationPreferencesDTO> {
  const now = new Date();
  const declined = status === "declined";
  await prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      locationConsentStatus: status,
      locationConsentAt: now,
      ...(declined ? { notifyNearby: false } : {}),
    },
    update: {
      locationConsentStatus: status,
      locationConsentAt: now,
      ...(declined ? { notifyNearby: false, locationUpdatedAt: null } : {}),
    },
  });
  if (declined) {
    await prisma.$executeRaw`UPDATE notification_preferences SET location = NULL WHERE user_id = ${userId}`;
  }
  return get(userId);
}

export async function setLocation(userId: number, { latitude, longitude }: LocationInput): Promise<NotificationPreferencesDTO> {
  // consentimiento chequeado en el mismo UPDATE: evita guardar tras una revocación
  const updated = await prisma.$executeRaw`
    UPDATE notification_preferences
    SET location = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326),
        location_updated_at = now()
    WHERE user_id = ${userId} AND location_consent_status = 'accepted'
  `;
  if (updated === 0) {
    throw new AppError(403, "No diste consentimiento para usar tu ubicación");
  }
  return get(userId);
}
