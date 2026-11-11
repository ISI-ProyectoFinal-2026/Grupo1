import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createPublishedReport, mockImageModeration } from "../helpers/reports";
import { createE2EContext, E2EUser, promoteTo } from "./helpers/factories";

/**
 * Journey B5 (issue #39): un usuario denuncia la publicación de otro, un
 * usuario común no puede ver la cola de moderación, y un moderador la ve y
 * acepta el flag, lo que oculta el reporte y avisa al dueño (#223).
 */
describe("E2E: moderación de reportes denunciados (B5)", () => {
  const ctx = createE2EContext("flag-moderation");
  // Ningún id de reporte llega a este valor en la base de pruebas.
  const UNKNOWN_REPORT_ID = 2_147_483_647;

  let owner: E2EUser;
  let reporter: E2EUser;
  let moderator: E2EUser;
  let bystander: E2EUser;
  let reportId: number;
  let flagId: number;

  const auth = (user: E2EUser) => ({ Authorization: `Bearer ${user.token}` });

  // Cada registerAndLogin hace bcrypt (12 rondas) dos veces: con 4 usuarios y las
  // suites corriendo en paralelo el hook supera los 5s por defecto de Jest.
  beforeAll(async () => {
    owner = await ctx.registerAndLogin("owner");
    reporter = await ctx.registerAndLogin("reporter");
    moderator = await ctx.registerAndLogin("moderator");
    bystander = await ctx.registerAndLogin("bystander");

    // La foto es obligatoria: el reporte nace pending y se publica directo (sin Backend IA).
    mockImageModeration();
    const report = await createPublishedReport(owner.token, {
      reportType: "lost",
      title: "Perro perdido en Flores",
      location: { lat: -34.63, lng: -58.46 },
    });
    jest.restoreAllMocks();
    reportId = report.id;
    ctx.trackReport(reportId);
  }, 30_000);

  afterAll(async () => {
    await ctx.cleanup();
    await prisma.$disconnect();
  });

  test("el dueño no puede denunciar su propio reporte (403)", async () => {
    const res = await request(app)
      .post(`/api/reports/${reportId}/flags`)
      .set(auth(owner))
      .send({ reason: "other", detail: "Me denuncio a mí mismo" });

    expect(res.status).toBe(403);
    expect(await prisma.reportFlag.count({ where: { reportId } })).toBe(0);
  });

  test("otro usuario denuncia el reporte publicado", async () => {
    const res = await request(app)
      .post(`/api/reports/${reportId}/flags`)
      .set(auth(reporter))
      .send({ reason: "not_an_animal" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ reportId, userId: reporter.id, status: "pending" });
    flagId = res.body.id;
  });

  test("denunciar dos veces el mismo reporte responde 409", async () => {
    const res = await request(app)
      .post(`/api/reports/${reportId}/flags`)
      .set(auth(reporter))
      .send({ reason: "spam" });

    expect(res.status).toBe(409);
  });

  test("un usuario regular no puede ver ni resolver la cola de moderación (403)", async () => {
    const list = await request(app).get("/api/report-flags").set(auth(reporter));
    expect(list.status).toBe(403);

    const resolve = await request(app)
      .patch(`/api/report-flags/reports/${reportId}`)
      .set(auth(reporter))
      .send({ action: "hide" });
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

  test("el moderador oculta el reporte, el dueño recibe el aviso y la denuncia sigue pendiente", async () => {
    const res = await request(app)
      .patch(`/api/report-flags/reports/${reportId}`)
      .set(auth(moderator))
      .send({ action: "hide" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: reportId, status: "hidden" });

    // Ya no es visible para la comunidad, pero el dueño lo sigue viendo.
    const anonymous = await request(app).get(`/api/reports/${reportId}`);
    expect(anonymous.status).toBe(404);
    const asOwner = await request(app).get(`/api/reports/${reportId}`).set(auth(owner));
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.status).toBe("hidden");

    const notifications = await request(app).get("/api/notifications").set(auth(owner));
    expect(notifications.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "report_status_change", title: "Tu reporte fue ocultado", reportId }),
      ])
    );
  });

  test("un reporte oculto no se puede denunciar (404)", async () => {
    const res = await request(app)
      .post(`/api/reports/${reportId}/flags`)
      .set(auth(bystander))
      .send({ reason: "spam" });

    expect(res.status).toBe(404);
  });

  test("ocultar dos veces el mismo reporte responde 409", async () => {
    const res = await request(app)
      .patch(`/api/report-flags/reports/${reportId}`)
      .set(auth(moderator))
      .send({ action: "hide" });

    expect(res.status).toBe(409);
  });

  test("moderar un reporte inexistente responde 404", async () => {
    const res = await request(app)
      .patch(`/api/report-flags/reports/${UNKNOWN_REPORT_ID}`)
      .set(auth(moderator))
      .send({ action: "hide" });

    expect(res.status).toBe(404);
  });
});
