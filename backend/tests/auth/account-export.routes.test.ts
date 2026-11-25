import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { issueAuthToken } from "../../src/services/auth-tokens.service";
import { seedTwoFactor } from "../helpers/two-factor";
import { createTestUser } from "../helpers/users";

// GET /api/auth/me/export (#366)
describe("GET /api/auth/me/export", () => {
  const userIds: number[] = [];
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const exportFor = (token: string) => request(app).get("/api/auth/me/export").set(bearer(token));
  const iso = (date: Date | null) => (date ? date.toISOString() : null);

  async function newUser(prefix: string) {
    const created = await createTestUser({ prefix, password: "Password123" });
    userIds.push(created.user.id);
    return created;
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  test("sin token responde 401", async () => {
    expect((await request(app).get("/api/auth/me/export")).status).toBe(401);
  });

  test("un usuario sin datos recibe las secciones vacías", async () => {
    const { user, token } = await newUser("export-empty");

    const res = await exportFor(token);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      account: { email: user.email, fullName: null, phone: null, twoFactorEnabled: false },
      pets: [],
      reports: [],
      reportFlags: [],
      adFlags: [],
      accountReportsMade: [],
      sanctions: [],
      chats: [],
      notifications: [],
      business: null,
    });
  });

  test("devuelve los datos propios campo por campo, sin secretos ni denunciantes", async () => {
    const { user, token } = await newUser("export-owner");
    const { user: other } = await newUser("export-other");
    const { user: reporter } = await newUser("export-reporter");

    const owner = await prisma.user.update({
      where: { id: user.id },
      data: { fullName: "Ana Pérez", phone: "+54 11 4555-1234" },
    });
    const { recoveryCodes } = await seedTwoFactor(user.id);
    const twoFactor = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const authToken = await issueAuthToken(user.id, "password_reset");
    const authTokenRow = await prisma.authToken.findFirstOrThrow({ where: { userId: user.id } });

    const pet = await prisma.pet.create({
      data: { userId: user.id, name: "Firulais", species: "dog", breed: "Mestizo", age: 3, color: "negro", photoUrls: ["https://x/p.jpg"], microchipId: "123" },
    });
    const report = await prisma.report.create({
      data: { userId: user.id, petId: pet.id, reportType: "lost", status: "published", title: "Perdido", locationAddress: "Palermo", showPhoneOnFlyer: true },
    });
    await prisma.$executeRaw`UPDATE reports SET location = ST_SetSRID(ST_MakePoint(-58.42, -34.58), 4326) WHERE id = ${report.id}`;
    const otherReport = await prisma.report.create({ data: { userId: other.id, reportType: "found", title: "Encontrado" } });
    const match = await prisma.reportMatch.create({
      data: { reportLostId: report.id, reportFoundId: otherReport.id, similarityScore: 0.9 },
    });

    const chat = await prisma.chat.create({ data: { userAId: user.id, userBId: other.id, reportId: report.id } });
    const sent = await prisma.message.create({ data: { chatId: chat.id, senderId: user.id, content: "hola, es mío" } });
    await prisma.message.create({ data: { chatId: chat.id, senderId: other.id, content: "mensaje-ajeno-secreto" } });

    const notification = await prisma.notification.create({
      data: { userId: user.id, type: "message", title: "Nuevo mensaje", message: 'Tenés un mensaje nuevo: "mensaje-ajeno-secreto"', chatId: chat.id },
    });
    await prisma.notificationPreference.create({
      data: { userId: user.id, notifyNearby: false, nearbyRadiusKm: 10, locationConsentStatus: "accepted", locationConsentAt: new Date(), locationUpdatedAt: new Date() },
    });
    await prisma.$executeRaw`UPDATE notification_preferences SET location = ST_SetSRID(ST_MakePoint(-58.4, -34.6), 4326) WHERE user_id = ${user.id}`;

    const flag = await prisma.reportFlag.create({ data: { reportId: otherReport.id, userId: user.id, reason: "other", detail: "no es un animal" } });
    const otherBusiness = await prisma.business.create({
      data: { userId: other.id, name: "Otro", cuit: `20-${Date.now().toString().slice(-8)}-2`, address: "Calle 2", phone: "456", category: "PET_SHOP" },
    });
    const otherAd = await prisma.ad.create({
      data: { businessId: otherBusiness.id, title: "Ad", body: "b", imageUrl: "https://x/a.jpg", radiusKm: 5 },
    });
    const adFlag = await prisma.adFlag.create({ data: { adId: otherAd.id, userId: user.id, reason: "spam" } });

    const made = await prisma.accountReport.create({ data: { reporterId: user.id, reportedUserId: other.id, severity: "mild" } });
    const sanction = await prisma.accountSanction.create({
      data: {
        userId: user.id,
        severity: "mild",
        kind: "temporary",
        status: "expired",
        reason: "x",
        triggeringReportIds: [987654],
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-01-08T00:00:00.000Z"),
      },
    });
    await prisma.accountReport.create({
      data: { reporterId: reporter.id, reportedUserId: user.id, severity: "mild", sanctionId: sanction.id },
    });
    await prisma.accountSanctionEvent.create({ data: { sanctionId: sanction.id, actorId: other.id, type: "created" } });

    const business = await prisma.business.create({
      data: {
        userId: user.id,
        name: "Veterinaria Ana",
        cuit: `20-${Date.now().toString().slice(-8)}-1`,
        address: "Calle 1",
        phone: "123",
        category: "VETERINARIA",
        plan: "PREMIUM",
        planExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
      },
    });
    const subscription = await prisma.subscription.create({
      data: {
        businessId: business.id,
        period: "MONTHLY",
        amountUsd: "9.99",
        provider: "fake",
        reference: "ref-1",
        status: "APPROVED",
        periodStart: new Date("2026-12-01T00:00:00.000Z"),
        periodEnd: new Date("2027-01-01T00:00:00.000Z"),
      },
    });
    const ad = await prisma.ad.create({
      data: { businessId: business.id, title: "Vacunas", body: "Promo", imageUrl: "https://x/v.jpg", radiusKm: 3 },
    });

    const res = await exportFor(token);

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toBe('attachment; filename="patitas-mis-datos.json"');
    expect(res.headers["cache-control"]).toBe("no-store");

    const body = res.body;
    expect(typeof body.exportedAt).toBe("string");
    expect(body.account).toEqual({
      email: owner.email,
      fullName: "Ana Pérez",
      phone: "+54 11 4555-1234",
      role: "usuario_regular",
      emailVerifiedAt: iso(owner.emailVerifiedAt),
      twoFactorEnabled: true,
      createdAt: iso(owner.createdAt),
    });
    expect(body.pets).toEqual([
      {
        id: pet.id,
        name: "Firulais",
        species: "dog",
        breed: "Mestizo",
        age: 3,
        color: "negro",
        description: null,
        photoUrls: ["https://x/p.jpg"],
        microchipId: "123",
        createdAt: iso(pet.createdAt),
      },
    ]);
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0]).toEqual({
      id: report.id,
      petId: pet.id,
      reportType: "lost",
      status: "published",
      title: "Perdido",
      description: null,
      imageUrl: null,
      extraImageUrls: [],
      customFlyerUrl: null,
      location: { lat: -34.58, lng: -58.42 },
      locationAddress: "Palermo",
      showPhoneOnFlyer: true,
      eventDate: null,
      createdAt: iso(report.createdAt),
      updatedAt: expect.any(String),
      publishedAt: null,
      closedReason: null,
      closedAt: null,
      matches: [
        {
          id: match.id,
          reportLostId: report.id,
          reportFoundId: otherReport.id,
          similarityScore: 0.9,
          status: "pending",
          createdAt: iso(match.createdAt),
          confirmedAt: null,
        },
      ],
    });
    expect(body.reportFlags).toEqual([
      { id: flag.id, reportId: otherReport.id, reason: "other", detail: "no es un animal", status: "pending", createdAt: iso(flag.createdAt) },
    ]);
    expect(body.adFlags).toEqual([
      { id: adFlag.id, adId: otherAd.id, reason: "spam", status: "pending", createdAt: iso(adFlag.createdAt) },
    ]);
    expect(body.accountReportsMade).toEqual([
      { id: made.id, reportedUserId: other.id, severity: "mild", createdAt: iso(made.createdAt) },
    ]);
    expect(body.sanctions).toEqual([
      {
        kind: "temporary",
        status: "expired",
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-01-08T00:00:00.000Z",
        createdAt: iso(sanction.createdAt),
      },
    ]);
    expect(body.chats).toEqual([
      {
        id: chat.id,
        reportId: report.id,
        createdAt: iso(chat.createdAt),
        messagesSent: [{ id: sent.id, content: "hola, es mío", imageUrl: null, createdAt: iso(sent.createdAt) }],
      },
    ]);
    expect(body.notifications).toEqual([
      {
        id: notification.id,
        type: "message",
        title: "Nuevo mensaje",
        // la vista previa trae texto de la otra parte
        message: "Tenés un mensaje nuevo.",
        reportId: null,
        chatId: chat.id,
        isRead: false,
        createdAt: iso(notification.createdAt),
      },
    ]);
    expect(body.notificationPreferences).toMatchObject({
      notifyNearby: false,
      nearbyRadiusKm: 10,
      locationConsentStatus: "accepted",
      location: { latitude: -34.6, longitude: -58.4 },
    });
    expect(body.business).toEqual({
      name: "Veterinaria Ana",
      cuit: business.cuit,
      address: "Calle 1",
      phone: "123",
      category: "VETERINARIA",
      latitude: null,
      longitude: null,
      description: null,
      website: null,
      socialLinks: [],
      plan: "PREMIUM",
      planExpiresAt: "2027-01-01T00:00:00.000Z",
      createdAt: iso(business.createdAt),
      subscriptions: [
        {
          period: "MONTHLY",
          amountUsd: "9.99",
          status: "APPROVED",
          periodStart: "2026-12-01T00:00:00.000Z",
          periodEnd: "2027-01-01T00:00:00.000Z",
          createdAt: iso(subscription.createdAt),
        },
      ],
      ads: [
        {
          id: ad.id,
          title: "Vacunas",
          body: "Promo",
          imageUrl: "https://x/v.jpg",
          radiusKm: 3,
          status: "ACTIVE",
          createdAt: iso(ad.createdAt),
          updatedAt: iso(ad.updatedAt),
        },
      ],
    });

    // búsqueda sobre el JSON serializado: ningún secreto ni identidad ajena
    const serialized = JSON.stringify(body);
    for (const absent of [
      "passwordHash",
      "tokenVersion",
      "twoFactorSecretEnc",
      "twoFactorEnabledAt",
      "twoFactorLastStep",
      "recovery",
      "reporterId",
      "triggeringReportIds",
      "actorId",
      "userAId",
      "userBId",
      "senderId",
      owner.passwordHash,
      twoFactor.twoFactorSecretEnc!,
      authToken,
      authTokenRow.tokenHash,
      ...recoveryCodes,
      other.email,
      reporter.email,
      "mensaje-ajeno-secreto",
      "987654",
    ]) {
      expect(serialized).not.toContain(absent);
    }
    expect(serialized).not.toMatch(new RegExp(`"(id|userId|reporterId)":${reporter.id}[,}]`));
  });
});
