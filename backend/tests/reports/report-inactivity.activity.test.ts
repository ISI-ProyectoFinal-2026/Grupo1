import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as reportsService from "../../src/services/reports.service";
import * as matchingService from "../../src/services/matching.service";
import * as chatsService from "../../src/services/chats.service";
import * as notificationsService from "../../src/services/notifications.service";
import { runInactivitySweep } from "../../src/services/report-inactivity.service";
import { createTestUser } from "../helpers/users";

const OLD = new Date("2026-01-01T00:00:00.000Z");

describe("actividad y cierre por inactividad (#264)", () => {
  let ownerId: number;
  let ownerToken: string;
  let otherId: number;
  let otherToken: string;
  const reportIds: number[] = [];
  const chatIds: number[] = [];

  async function createReport(userId: number, status: "published" | "hidden" | "pending" = "published") {
    const report = await prisma.report.create({
      data: {
        userId,
        reportType: "lost",
        status,
        title: "Inactividad de prueba",
        imageUrl: "https://cdn.example.com/a.jpg",
        lastActivityAt: OLD,
        inactivityWarned30At: OLD,
        inactivityWarned37At: OLD,
      },
    });
    reportIds.push(report.id);
    return report.id;
  }

  const activity = (id: number) =>
    prisma.report.findUniqueOrThrow({
      where: { id },
      select: { lastActivityAt: true, inactivityWarned30At: true, inactivityWarned37At: true, closedReason: true, closedAt: true, status: true },
    });

  beforeAll(async () => {
    ({ user: { id: ownerId }, token: ownerToken } = await createTestUser({ prefix: "inact-owner" }));
    ({ user: { id: otherId }, token: otherToken } = await createTestUser({ prefix: "inact-other" }));
  });

  beforeEach(() => {
    jest.spyOn(matchingService, "triggerEmbeddingGeneration").mockResolvedValue(undefined);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.message.deleteMany({ where: { chatId: { in: chatIds } } });
    await prisma.chat.deleteMany({ where: { id: { in: chatIds.splice(0) } } });
    await prisma.reportMatch.deleteMany({
      where: { OR: [{ reportLostId: { in: reportIds } }, { reportFoundId: { in: reportIds } }] },
    });
    await prisma.notification.deleteMany({ where: { reportId: { in: reportIds } } });
    await prisma.report.deleteMany({ where: { id: { in: reportIds.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await prisma.$disconnect();
  });

  test("un reporte nuevo nace con lastActivityAt", async () => {
    const report = await prisma.report.create({
      data: { userId: ownerId, reportType: "lost", title: "Nuevo", status: "published" },
    });
    reportIds.push(report.id);
    expect(report.lastActivityAt).toBeInstanceOf(Date);
    expect(report.closedReason).toBeNull();
  });

  describe("editar", () => {
    test("update() reinicia la actividad y los avisos", async () => {
      const id = await createReport(ownerId);

      await reportsService.update(id, ownerId, { title: "Título editado" });

      const row = await activity(id);
      expect(row.lastActivityAt.getTime()).toBeGreaterThan(OLD.getTime());
      expect(row.inactivityWarned30At).toBeNull();
      expect(row.inactivityWarned37At).toBeNull();
    });
  });

  describe("avisos pendientes", () => {
    async function createWarning(reportId: number) {
      await prisma.notification.create({ data: { userId: ownerId, type: "inactivity_warning", reportId } });
      await prisma.notification.create({ data: { userId: ownerId, type: "message", reportId } });
    }
    const readByType = async (reportId: number) =>
      Object.fromEntries((await prisma.notification.findMany({ where: { reportId } })).map((n) => [n.type, n.isRead]));

    test("keepShowing() marca como leído el aviso y no otros tipos", async () => {
      const id = await createReport(ownerId);
      await createWarning(id);

      await reportsService.keepShowing(id, ownerId);

      expect(await readByType(id)).toEqual({ inactivity_warning: true, message: false });
    });

    test("close() marca como leído el aviso", async () => {
      const id = await createReport(ownerId);
      await createWarning(id);

      await reportsService.close(id, ownerId);

      expect((await readByType(id)).inactivity_warning).toBe(true);
    });

    test("update() marca como leído el aviso", async () => {
      const id = await createReport(ownerId);
      await createWarning(id);

      await reportsService.update(id, ownerId, { title: "Editado" });

      expect((await readByType(id)).inactivity_warning).toBe(true);
    });

    test("createMessage() marca como leído el aviso del reporte del chat", async () => {
      const id = await createReport(ownerId);
      await createWarning(id);
      const chat = await prisma.chat.create({ data: { userAId: ownerId, userBId: otherId, reportId: id } });
      chatIds.push(chat.id);

      await chatsService.createMessage(chat.id, ownerId, { content: "hola" });

      expect((await readByType(id)).inactivity_warning).toBe(true);
    });
  });

  describe("autor suspendido", () => {
    test("no se avisa ni se cierra mientras dura la suspensión y se procesa después", async () => {
      const { user } = await createTestUser({ prefix: "inact-susp" });
      try {
        const id = await createReport(user.id);
        const sanction = await prisma.accountSanction.create({
          data: {
            userId: user.id,
            severity: "mild",
            kind: "temporary",
            status: "active",
            reason: "fixed",
            triggeringReportIds: [],
            startsAt: new Date(Date.now() - 1000),
            endsAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });

        const during = await runInactivitySweep(new Date());
        expect(during.closed).toBe(0);
        expect(await activity(id)).toMatchObject({ status: "published", lastActivityAt: OLD, closedReason: null });

        await prisma.accountSanction.update({ where: { id: sanction.id }, data: { status: "expired" } });

        await runInactivitySweep(new Date());
        expect(await activity(id)).toMatchObject({ status: "resolved", closedReason: "inactivity" });
      } finally {
        await prisma.notification.deleteMany({ where: { userId: user.id } });
        await prisma.report.deleteMany({ where: { userId: user.id } });
        await prisma.accountSanction.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    });
  });

  describe("cierre manual", () => {
    test("close() registra closedReason manual y closedAt", async () => {
      const id = await createReport(ownerId);

      await reportsService.close(id, ownerId);

      const row = await activity(id);
      expect(row).toMatchObject({ status: "resolved", closedReason: "manual" });
      expect(row.closedAt).toBeInstanceOf(Date);
    });

    test("update() con status resolved también registra el cierre manual", async () => {
      const id = await createReport(ownerId);

      await reportsService.update(id, ownerId, { status: "resolved" });

      expect(await activity(id)).toMatchObject({ status: "resolved", closedReason: "manual" });
    });
  });

  describe("Seguir mostrando", () => {
    test("keepShowing() reinicia la actividad y los avisos", async () => {
      const id = await createReport(ownerId);

      await reportsService.keepShowing(id, ownerId);

      const row = await activity(id);
      expect(row.lastActivityAt.getTime()).toBeGreaterThan(OLD.getTime());
      expect(row.inactivityWarned30At).toBeNull();
      expect(row.inactivityWarned37At).toBeNull();
    });

    test("responde 403 si no es el dueño", async () => {
      const id = await createReport(ownerId);
      await expect(reportsService.keepShowing(id, otherId)).rejects.toMatchObject({ statusCode: 403 });
    });

    test("responde 404 si no existe", async () => {
      await expect(reportsService.keepShowing(999999999, ownerId)).rejects.toMatchObject({ statusCode: 404 });
    });

    test.each(["hidden", "pending"] as const)("responde 409 si el reporte está %s y no cambia nada", async (status) => {
      const id = await createReport(ownerId, status);

      await expect(reportsService.keepShowing(id, ownerId)).rejects.toMatchObject({ statusCode: 409 });

      expect((await activity(id)).lastActivityAt).toEqual(OLD);
    });

    test("responde 409 si el reporte ya está resuelto", async () => {
      const id = await createReport(ownerId);
      await reportsService.close(id, ownerId);
      await expect(reportsService.keepShowing(id, ownerId)).rejects.toMatchObject({ statusCode: 409 });
    });

    test("POST /api/reports/:id/keep-active responde 200 al dueño, 401 sin sesión y 403 a un tercero", async () => {
      const id = await createReport(ownerId);

      expect((await request(app).post(`/api/reports/${id}/keep-active`)).status).toBe(401);
      expect(
        (await request(app).post(`/api/reports/${id}/keep-active`).set("Authorization", `Bearer ${otherToken}`)).status
      ).toBe(403);
      const res = await request(app).post(`/api/reports/${id}/keep-active`).set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect((await activity(id)).lastActivityAt.getTime()).toBeGreaterThan(OLD.getTime());
    });
  });

  describe("coincidencias y chats", () => {
    test("confirmMatch() reinicia solo el reporte de quien confirma", async () => {
      const lostId = await createReport(ownerId);
      const foundId = await createReport(otherId);
      const match = await prisma.reportMatch.create({
        data: { reportLostId: lostId, reportFoundId: foundId, similarityScore: 0.8, status: "pending" },
      });

      await matchingService.confirmMatch(lostId, match.id, ownerId);

      const confirmer = await activity(lostId);
      expect(confirmer.lastActivityAt.getTime()).toBeGreaterThan(OLD.getTime());
      expect(confirmer.inactivityWarned30At).toBeNull();
      const other = await activity(foundId);
      expect(other.lastActivityAt).toEqual(OLD);
      expect(other.inactivityWarned30At).toEqual(OLD);
    });

    test("rejectMatch() no cuenta como actividad", async () => {
      const lostId = await createReport(ownerId);
      const foundId = await createReport(otherId);
      const match = await prisma.reportMatch.create({
        data: { reportLostId: lostId, reportFoundId: foundId, similarityScore: 0.8, status: "pending" },
      });

      await matchingService.rejectMatch(lostId, match.id, ownerId);

      expect((await activity(lostId)).lastActivityAt).toEqual(OLD);
      expect((await activity(foundId)).lastActivityAt).toEqual(OLD);
    });

    test("createMessage() de la otra parte no reinicia la actividad", async () => {
      const id = await createReport(ownerId);
      const chat = await prisma.chat.create({ data: { userAId: ownerId, userBId: otherId, reportId: id } });
      chatIds.push(chat.id);

      await chatsService.createMessage(chat.id, otherId, { content: "hola" });

      const row = await activity(id);
      expect(row.lastActivityAt).toEqual(OLD);
      expect(row.inactivityWarned37At).toEqual(OLD);
    });

    test("createMessage() del dueño reinicia la actividad del reporte del chat", async () => {
      const id = await createReport(ownerId);
      const chat = await prisma.chat.create({ data: { userAId: ownerId, userBId: otherId, reportId: id } });
      chatIds.push(chat.id);

      await chatsService.createMessage(chat.id, ownerId, { content: "hola" });

      const row = await activity(id);
      expect(row.lastActivityAt.getTime()).toBeGreaterThan(OLD.getTime());
      expect(row.inactivityWarned37At).toBeNull();
    });

    test("createMessage() en un chat sin reporte no falla", async () => {
      const chat = await prisma.chat.create({ data: { userAId: ownerId, userBId: otherId } });
      chatIds.push(chat.id);

      await expect(chatsService.createMessage(chat.id, otherId, { content: "hola" })).resolves.toMatchObject({
        chatId: chat.id,
      });
    });
  });

  describe("notificaciones", () => {
    test("notifyInactivityWarning() crea inactivity_warning con el número de aviso", async () => {
      const id = await createReport(ownerId);

      const first = await notificationsService.notifyInactivityWarning(id, 30);
      const second = await notificationsService.notifyInactivityWarning(id, 37);

      expect(first).toMatchObject({ type: "inactivity_warning", userId: ownerId, reportId: id });
      expect(first?.title).toBe("¿Querés seguir mostrando tu reporte?");
      expect(first?.message).toContain("30 días");
      expect(second?.message).toContain("37 días");
    });

    test("notifyInactivityClosed() crea inactivity_closed", async () => {
      const id = await createReport(ownerId);

      const notification = await notificationsService.notifyInactivityClosed(id);

      expect(notification).toMatchObject({ type: "inactivity_closed", userId: ownerId, reportId: id });
    });
  });

  describe("feed", () => {
    test("un reporte cerrado por inactividad no aparece en el feed", async () => {
      const id = await createReport(ownerId);
      await prisma.report.update({
        where: { id },
        data: { status: "resolved", closedReason: "inactivity", closedAt: new Date() },
      });

      const feed = await reportsService.list({}, otherId);

      expect(feed.map((r) => r.id)).not.toContain(id);
    });
  });
});
