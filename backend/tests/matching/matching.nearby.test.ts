import { Prisma } from "@prisma/client";
import { prisma } from "../../src/db/client";
import { triggerEmbeddingGeneration } from "../../src/services/matching.service";
import * as reportMatchingService from "../../src/services/report-matching.service";
import { createTestUser } from "../helpers/users";

describe("triggerEmbeddingGeneration: avisos de reportes cercanos (#33)", () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;
  let authorId: number;
  let nearbyUserId: number;
  const reportIds: number[] = [];

  async function createPendingReport() {
    const report = await prisma.report.create({
      data: {
        userId: authorId,
        reportType: "lost",
        status: "pending",
        title: "Gato perdido en Palermo",
        imageUrl: "https://pub-test.r2.dev/pets/gato.jpg",
      },
    });
    reportIds.push(report.id);
    await prisma.$executeRaw(
      Prisma.sql`UPDATE reports SET location = ST_SetSRID(ST_MakePoint(-64.2, -31.4), 4326) WHERE id = ${report.id}`
    );
    return { id: report.id, imageUrl: report.imageUrl! };
  }

  const nearbyNotifications = () =>
    prisma.notification.findMany({ where: { userId: nearbyUserId, type: "nearby_report" } });

  beforeAll(async () => {
    authorId = (await createTestUser({ prefix: "nearby-int-author" })).user.id;
    nearbyUserId = (await createTestUser({ prefix: "nearby-int-user" })).user.id;
    await prisma.notificationPreference.create({
      data: { userId: nearbyUserId, locationConsentStatus: "accepted", locationConsentAt: new Date() },
    });
    await prisma.$executeRaw(
      Prisma.sql`UPDATE notification_preferences SET location = ST_SetSRID(ST_MakePoint(-64.2, -31.4), 4326), location_updated_at = now() WHERE user_id = ${nearbyUserId}`
    );
  });

  beforeEach(() => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    // fuera de foco: el matching contra la base compartida podría avisar a terceros
    jest.spyOn(reportMatchingService, "findAndStoreMatches").mockResolvedValue(0);
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    await prisma.notification.deleteMany({ where: { userId: { in: [authorId, nearbyUserId] } } });
    await prisma.report.deleteMany({ where: { id: { in: reportIds.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.notificationPreference.deleteMany({ where: { userId: nearbyUserId } });
    await prisma.user.deleteMany({ where: { id: { in: [authorId, nearbyUserId] } } });
    await prisma.$disconnect();
  });

  test("al publicarse avisa a los usuarios cercanos", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ has_animal: true, embedding: Array<number>(768).fill(0.1) }),
    });
    const report = await createPendingReport();

    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    const notifications = await nearbyNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].reportId).toBe(report.id);
  });

  test("al rechazarse no avisa a nadie", async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ has_animal: false, embedding: null }) });
    const report = await createPendingReport();

    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    await expect(nearbyNotifications()).resolves.toHaveLength(0);
  });
});
