import { Prisma } from "@prisma/client";
import { prisma } from "../../src/db/client";
import { createForNearbyReport } from "../../src/services/notifications.service";
import { createTestUser } from "../helpers/users";

const LAT = -34.6;
const LNG = -58.4;
// ~111 km por grado de latitud; alcanza para distancias aproximadas
const north = (km: number) => LAT + km / 111;

interface PrefOptions {
  radius?: number;
  type?: "lost" | "found" | "both";
  notifyNearby?: boolean;
  consent?: "accepted" | "declined" | null;
  km?: number | null;
}

describe("notifications.service createForNearbyReport (#33)", () => {
  let authorId: number;
  const userIds: number[] = [];
  const reportIds: number[] = [];

  async function newUser(opts: PrefOptions = {}): Promise<number> {
    const { user } = await createTestUser({ prefix: "nearby" });
    userIds.push(user.id);
    const { radius = 5, type = "both", notifyNearby = true, consent = "accepted", km = 0 } = opts;
    await prisma.notificationPreference.create({
      data: {
        userId: user.id,
        nearbyRadiusKm: radius,
        nearbyReportType: type,
        notifyNearby,
        locationConsentStatus: consent,
        locationConsentAt: consent ? new Date() : null,
      },
    });
    if (km !== null) {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE notification_preferences SET location = ST_SetSRID(ST_MakePoint(${LNG}, ${north(km)}), 4326), location_updated_at = now() WHERE user_id = ${user.id}`
      );
    }
    return user.id;
  }

  async function newReport(
    opts: { type?: "lost" | "found"; status?: "published" | "pending" | "rejected"; withLocation?: boolean } = {}
  ) {
    const { type = "lost", status = "published", withLocation = true } = opts;
    const report = await prisma.report.create({
      data: { userId: authorId, reportType: type, status, title: "Perro con collar rojo" },
    });
    reportIds.push(report.id);
    if (withLocation) {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE reports SET location = ST_SetSRID(ST_MakePoint(${LNG}, ${LAT}), 4326) WHERE id = ${report.id}`
      );
    }
    return report.id;
  }

  const recipientsOf = async (reportId: number) =>
    (await createForNearbyReport(reportId)).map((n) => n.userId).sort((a, b) => a - b);

  beforeAll(async () => {
    authorId = (await createTestUser({ prefix: "nearby-author" })).user.id;
    userIds.push(authorId);
  });

  afterEach(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.report.deleteMany({ where: { id: { in: reportIds.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("notifica a quien cumple todo, con el formato esperado", async () => {
    const u = await newUser();
    const reportId = await newReport();
    const created = await createForNearbyReport(reportId);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ userId: u, type: "nearby_report", reportId, title: "Nuevo reporte cerca tuyo" });
    expect(created[0].message).toContain("Perro con collar rojo");
    expect(created[0].message).toContain("perdida");
  });

  it("el mensaje indica mascota encontrada para reportes found", async () => {
    await newUser();
    const created = await createForNearbyReport(await newReport({ type: "found" }));
    expect(created[0].message).toContain("encontrada");
  });

  it("no notifica al autor aunque cumpla todo", async () => {
    await prisma.notificationPreference.create({
      data: { userId: authorId, locationConsentStatus: "accepted", locationConsentAt: new Date() },
    });
    await prisma.$executeRaw(
      Prisma.sql`UPDATE notification_preferences SET location = ST_SetSRID(ST_MakePoint(${LNG}, ${LAT}), 4326) WHERE user_id = ${authorId}`
    );
    await expect(createForNearbyReport(await newReport())).resolves.toEqual([]);
  });

  it.each([
    [1, 0.5, 3],
    [2, 1.5, 3],
    [5, 3, 7],
    [10, 7, 15],
  ])("radio %i km: recibe a %f km y no a %f km", async (radius, inKm, outKm) => {
    const inside = await newUser({ radius, km: inKm });
    await newUser({ radius, km: outKm });
    await expect(recipientsOf(await newReport())).resolves.toEqual([inside]);
  });

  it("filtra por tipo de reporte: coincidente y both reciben, el otro no", async () => {
    const lostPref = await newUser({ type: "lost" });
    await newUser({ type: "found" });
    const both = await newUser({ type: "both" });
    await expect(recipientsOf(await newReport({ type: "lost" }))).resolves.toEqual(
      [lostPref, both].sort((a, b) => a - b)
    );
  });

  it("no notifica con notify_nearby=false", async () => {
    await newUser({ notifyNearby: false });
    await expect(createForNearbyReport(await newReport())).resolves.toEqual([]);
  });

  it("no notifica sin consentimiento accepted", async () => {
    await newUser({ consent: "declined" });
    await newUser({ consent: null });
    await expect(createForNearbyReport(await newReport())).resolves.toEqual([]);
  });

  it("no notifica si el usuario no tiene ubicación guardada", async () => {
    await newUser({ km: null });
    await expect(createForNearbyReport(await newReport())).resolves.toEqual([]);
  });

  it("reporte sin location devuelve []", async () => {
    await newUser();
    await expect(createForNearbyReport(await newReport({ withLocation: false }))).resolves.toEqual([]);
  });

  it("reporte inexistente devuelve []", async () => {
    await expect(createForNearbyReport(2147483000)).resolves.toEqual([]);
  });

  it.each(["pending", "rejected"] as const)("reporte %s no genera avisos", async (status) => {
    await newUser();
    await expect(createForNearbyReport(await newReport({ status }))).resolves.toEqual([]);
  });

  it("es idempotente: llamarlo dos veces no duplica", async () => {
    const u = await newUser();
    const reportId = await newReport();
    await expect(createForNearbyReport(reportId)).resolves.toHaveLength(1);
    await expect(createForNearbyReport(reportId)).resolves.toEqual([]);
    await expect(prisma.notification.count({ where: { userId: u, type: "nearby_report", reportId } })).resolves.toBe(1);
  });
});
