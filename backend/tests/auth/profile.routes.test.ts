import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { loadFlyerDetails } from "../../src/services/flyer.service";
import * as reportsService from "../../src/services/reports.service";
import { createPublishedReport, mockImageModeration } from "../helpers/reports";
import { createTestUser } from "../helpers/users";

// PATCH /api/auth/me (#366)
describe("PATCH /api/auth/me", () => {
  const userIds: number[] = [];
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const patch = (token: string, body: unknown) => request(app).patch("/api/auth/me").set(bearer(token)).send(body as object);

  async function newUser(prefix: string) {
    const created = await createTestUser({ prefix });
    userIds.push(created.user.id);
    return created;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.report.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  test("sin token responde 401", async () => {
    expect((await request(app).patch("/api/auth/me").send({ fullName: "Ana" })).status).toBe(401);
  });

  test("actualiza nombre y teléfono y devuelve el usuario público", async () => {
    const { user, token } = await newUser("profile-update");

    const res = await patch(token, { fullName: "  Ana Pérez ", phone: " +54 9 11 1234-5678 " });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, fullName: "Ana Pérez", phone: "+54 9 11 1234-5678" });
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("tokenVersion");
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored).toMatchObject({ fullName: "Ana Pérez", phone: "+54 9 11 1234-5678" });
  });

  test("un campo ausente no se toca y el string vacío borra el teléfono", async () => {
    const { user, token } = await newUser("profile-clear");
    await prisma.user.update({ where: { id: user.id }, data: { fullName: "Ana", phone: "11 4555 1234" } });

    const res = await patch(token, { phone: "" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ fullName: "Ana", phone: null });
  });

  test.each([
    ["teléfono inválido", { phone: "123" }],
    ["nombre vacío", { fullName: "  " }],
    ["body vacío", {}],
    ["role en el body", { fullName: "Ana", role: "admin" }],
    ["email en el body", { email: "otro@example.com" }],
  ])("%s responde 400 y no cambia nada", async (_case, body) => {
    const { user, token } = await newUser("profile-invalid");

    const res = await patch(token, body);

    expect(res.status).toBe(400);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored).toMatchObject({ fullName: null, phone: null, role: user.role, email: user.email });
  });

  // RF-23 por el camino real: teléfono cargado por la API y consentimiento del reporte
  describe("teléfono en el flyer", () => {
    const flyerPhone = async (reportId: number) => (await loadFlyerDetails(await reportsService.getById(reportId))).phone;

    test("aparece con teléfono y consentimiento, y desaparece al quitar cualquiera de los dos", async () => {
      const { user, token } = await newUser("profile-flyer");
      mockImageModeration();

      expect((await patch(token, { phone: "+54 11 4555-1234" })).status).toBe(200);
      const me = await request(app).get("/api/auth/me").set(bearer(token));
      expect(me.body.phone).toBe("+54 11 4555-1234");

      const report = await createPublishedReport(token, {
        userId: user.id,
        reportType: "lost",
        title: "Perro perdido en Palermo",
        location: { lat: -34.58, lng: -58.42 },
        showPhoneOnFlyer: true,
      });
      expect(report.showPhoneOnFlyer).toBe(true);
      expect(await flyerPhone(report.id)).toBe("+54 11 4555-1234");

      // sin consentimiento no sale aunque haya teléfono
      const off = await request(app).put(`/api/reports/${report.id}`).set(bearer(token)).send({ showPhoneOnFlyer: false });
      expect(off.status).toBe(200);
      expect(await flyerPhone(report.id)).toBeNull();

      // con consentimiento pero sin teléfono tampoco
      expect((await request(app).put(`/api/reports/${report.id}`).set(bearer(token)).send({ showPhoneOnFlyer: true })).status).toBe(200);
      expect(await flyerPhone(report.id)).toBe("+54 11 4555-1234");
      expect((await patch(token, { phone: null })).status).toBe(200);
      expect(await flyerPhone(report.id)).toBeNull();
    });
  });
});
