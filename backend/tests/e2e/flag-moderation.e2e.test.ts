import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createE2EContext, E2EUser, promoteTo } from "./helpers/factories";

/**
 * Journey B5 (issue #39): un usuario denuncia la publicación de otro, un
 * usuario común no puede ver la cola de moderación, y un moderador la ve y
 * resuelve el flag, lo que oculta (rechaza) el reporte.
 */
describe("E2E: moderación de reportes denunciados (B5)", () => {
  const ctx = createE2EContext("flag-moderation");
  // Ningún id de flag llega a este valor en la base de pruebas.
  const UNKNOWN_FLAG_ID = 2_147_483_647;

  let owner: E2EUser;
  let reporter: E2EUser;
  let moderator: E2EUser;
  let reportId: number;
  let flagId: number;

  const auth = (user: E2EUser) => ({ Authorization: `Bearer ${user.token}` });

  beforeAll(async () => {
    owner = await ctx.registerAndLogin("owner");
    reporter = await ctx.registerAndLogin("reporter");
    moderator = await ctx.registerAndLogin("moderator");

    // Sin imagen el reporte nace published: no hace falta el Backend IA.
    const res = await request(app)
      .post("/api/reports")
      .set(auth(owner))
      .send({ reportType: "lost", title: "Perro perdido en Flores", location: { lat: -34.63, lng: -58.46 } });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("published");
    reportId = res.body.id;
    ctx.trackReport(reportId);
  });

  afterAll(async () => {
    await ctx.cleanup();
    await prisma.$disconnect();
  });

  test("otro usuario denuncia el reporte publicado", async () => {
    const res = await request(app)
      .post(`/api/reports/${reportId}/flags`)
      .set(auth(reporter))
      .send({ reason: "Es spam, no es una mascota" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ reportId, userId: reporter.id, status: "pending" });
    flagId = res.body.id;
  });

  test("denunciar dos veces el mismo reporte responde 409", async () => {
    const res = await request(app)
      .post(`/api/reports/${reportId}/flags`)
      .set(auth(reporter))
      .send({ reason: "Otra vez" });

    expect(res.status).toBe(409);
  });

  test("un usuario regular no puede ver ni resolver la cola de moderación (403)", async () => {
    const list = await request(app).get("/api/report-flags").set(auth(reporter));
    expect(list.status).toBe(403);

    const resolve = await request(app).patch(`/api/report-flags/${flagId}`).set(auth(reporter));
    expect(resolve.status).toBe(403);
  });

  test("un moderador ve el flag pendiente en la cola", async () => {
    await promoteTo(moderator.id, "moderador");

    const res = await request(app).get("/api/report-flags").set(auth(moderator));

    expect(res.status).toBe(200);
    // La base es compartida: puede haber otros flags pendientes, se busca el nuestro.
    const flag = res.body.find((f: { id: number }) => f.id === flagId);
    expect(flag).toMatchObject({ status: "pending", report: { id: reportId, status: "published" } });
  });

  test("el moderador resuelve el flag y el reporte queda rejected", async () => {
    const res = await request(app).patch(`/api/report-flags/${flagId}`).set(auth(moderator));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: flagId, status: "reviewed", report: { id: reportId, status: "rejected" } });

    // Ya no es visible para la comunidad, pero el dueño lo sigue viendo.
    const anonymous = await request(app).get(`/api/reports/${reportId}`);
    expect(anonymous.status).toBe(404);
    const asOwner = await request(app).get(`/api/reports/${reportId}`).set(auth(owner));
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.status).toBe("rejected");

    // Y sale de la cola de pendientes.
    const queue = await request(app).get("/api/report-flags").set(auth(moderator));
    expect(queue.body.some((f: { id: number }) => f.id === flagId)).toBe(false);
  });

  test("resolver dos veces el mismo flag responde 409", async () => {
    const res = await request(app).patch(`/api/report-flags/${flagId}`).set(auth(moderator));

    expect(res.status).toBe(409);
  });

  test("resolver un flag inexistente responde 404", async () => {
    const res = await request(app).patch(`/api/report-flags/${UNKNOWN_FLAG_ID}`).set(auth(moderator));

    expect(res.status).toBe(404);
  });
});
