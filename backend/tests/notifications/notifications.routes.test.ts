import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

describe("/api/notifications", () => {
  let userId: number;
  let otherUserId: number;
  let token: string;
  let otherToken: string;
  let reportId: number;
  let otherReportId: number;
  let olderNotificationId: number;
  let newerNotificationId: number;

  const createdNotificationIds: number[] = [];

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `notifications-routes-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;
    token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const otherUser = await prisma.user.create({
      data: { email: `notifications-routes-test-other-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    otherUserId = otherUser.id;
    otherToken = jwt.sign({ sub: otherUser.id, email: otherUser.email }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });

    const report = await prisma.report.create({
      data: { userId, reportType: "lost", status: "published", title: "Perro perdido cerca de Once" },
    });
    reportId = report.id;

    const otherReport = await prisma.report.create({
      data: { userId: otherUserId, reportType: "found", status: "published", title: "Perro encontrado en Once" },
    });
    otherReportId = otherReport.id;

    const older = await prisma.notification.create({
      data: {
        userId,
        type: "message",
        title: "Notificación vieja",
        message: "mensaje viejo",
        reportId,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    });
    olderNotificationId = older.id;

    const newer = await prisma.notification.create({
      data: {
        userId,
        type: "message",
        title: "Notificación nueva",
        message: "mensaje nuevo",
        reportId,
        createdAt: new Date("2024-06-01T00:00:00.000Z"),
      },
    });
    newerNotificationId = newer.id;
  });

  afterEach(async () => {
    while (createdNotificationIds.length > 0) {
      const id = createdNotificationIds.pop()!;
      await prisma.notification.deleteMany({ where: { id } });
    }
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { id: { in: [olderNotificationId, newerNotificationId] } } });
    await prisma.report.deleteMany({ where: { id: { in: [reportId, otherReportId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await prisma.$disconnect();
  });

  test("GET /api/notifications sin token responde 401", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });

  test("GET /api/notifications devuelve solo las notificaciones propias ordenadas por fecha desc", async () => {
    const res = await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((n: { id: number }) => n.id);
    expect(ids).toContain(olderNotificationId);
    expect(ids).toContain(newerNotificationId);
    expect(ids.indexOf(newerNotificationId)).toBeLessThan(ids.indexOf(olderNotificationId));

    const otherRes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${otherToken}`);
    expect(otherRes.status).toBe(200);
    expect(otherRes.body.some((n: { id: number }) => n.id === olderNotificationId)).toBe(false);
  });

  test("PUT /api/notifications/:id/read sin token responde 401", async () => {
    const res = await request(app).put(`/api/notifications/${olderNotificationId}/read`);
    expect(res.status).toBe(401);
  });

  test("PUT /api/notifications/:id/read marca la notificación propia como leída", async () => {
    const res = await request(app)
      .put(`/api/notifications/${olderNotificationId}/read`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(olderNotificationId);
    expect(res.body.isRead).toBe(true);
  });

  test("PUT /api/notifications/:id/read responde 403 si la notificación es de otro usuario", async () => {
    const res = await request(app)
      .put(`/api/notifications/${newerNotificationId}/read`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  test("PUT /api/notifications/:id/read responde 404 si la notificación no existe", async () => {
    const res = await request(app)
      .put("/api/notifications/999999999/read")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test("DELETE /api/notifications/:id sin token responde 401", async () => {
    const res = await request(app).delete(`/api/notifications/${newerNotificationId}`);
    expect(res.status).toBe(401);
  });

  test("DELETE /api/notifications/:id responde 403 si la notificación es de otro usuario", async () => {
    const res = await request(app)
      .delete(`/api/notifications/${newerNotificationId}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(403);

    const stillExists = await prisma.notification.findUnique({ where: { id: newerNotificationId } });
    expect(stillExists).not.toBeNull();
  });

  test("DELETE /api/notifications/:id elimina la notificación propia y responde 204", async () => {
    const notification = await prisma.notification.create({
      data: { userId, type: "message", title: "para borrar", message: "para borrar", reportId },
    });

    const res = await request(app)
      .delete(`/api/notifications/${notification.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);

    const deleted = await prisma.notification.findUnique({ where: { id: notification.id } });
    expect(deleted).toBeNull();
  });
});
