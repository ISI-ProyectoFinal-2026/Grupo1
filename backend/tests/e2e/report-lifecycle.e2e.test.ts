import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createE2EContext, E2EUser } from "./helpers/factories";
import { installAiStub, AiStub, PET_EMBEDDING_RESPONSE } from "./helpers/ai-stub";
import { waitFor, waitForReportStatus } from "./helpers/wait-for";

/**
 * Journey B1 (issue #39): ciclo de vida completo de un reporte encadenando
 * llamadas HTTP reales contra la app. Lo único que se simula es el Backend IA:
 * el screening y el embedding se responden con un stub sobre `fetch`. El
 * matching y su notificación los hace este backend (ADR-0029): ambos reportes
 * reciben el mismo embedding, así que matchean con similitud 1.
 */
describe("E2E: ciclo de vida de un reporte (B1 camino feliz)", () => {
  const R2_PUBLIC_URL = "https://pub-e2e.r2.dev";
  const originalEnv = { ...process.env };
  const ctx = createE2EContext("report-lifecycle");

  let ai: AiStub;
  let owner: E2EUser;
  let finder: E2EUser;
  let lostReportId: number;
  let foundReportId: number;
  let matchId: number;

  const auth = (user: E2EUser) => ({ Authorization: `Bearer ${user.token}` });

  // Cada registerAndLogin hace bcrypt (12 rondas) dos veces: con las suites
  // corriendo en paralelo el hook supera los 5s por defecto de Jest.
  beforeAll(async () => {
    process.env.R2_PUBLIC_URL = R2_PUBLIC_URL;
    process.env.AI_SERVICE_URL = "http://ai-e2e.test";
    process.env.INTERNAL_API_KEY = "e2e-internal-key";

    ai = installAiStub({ analyze: { status: 200, body: { has_animal: true } }, embedding: PET_EMBEDDING_RESPONSE });

    owner = await ctx.registerAndLogin("owner");
    finder = await ctx.registerAndLogin("finder");
  }, 30_000);

  afterAll(async () => {
    ai.restore();
    process.env = { ...originalEnv };
    await ctx.cleanup();
    await prisma.$disconnect();
  });

  test("el dueño crea un reporte con imagen y queda pending hasta la moderación", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set(auth(owner))
      .send({
        reportType: "lost",
        title: "Perra perdida en Palermo",
        location: { lat: -34.58, lng: -58.42 },
        imageUrl: `${R2_PUBLIC_URL}/pets/e2e-lost.jpg`,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.userId).toBe(owner.id);
    lostReportId = res.body.id;
    ctx.trackReport(lostReportId);

    // El screening sincrónico consultó al Backend IA antes de persistir.
    expect(ai.callsTo("analyze")).toHaveLength(1);
  });

  test("el Backend IA aprueba la imagen y el reporte pasa a published", async () => {
    const report = await waitForReportStatus(app, lostReportId, "published", owner.token);

    expect(report.publishedAt).not.toBeNull();
    expect(ai.callsTo("embedding")).toContainEqual(
      expect.objectContaining({
        url: "http://ai-e2e.test/images/embedding",
        body: { image_url: `${R2_PUBLIC_URL}/pets/e2e-lost.jpg` },
      })
    );
  });

  test("el dueño recibe la notificación report_status_change", async () => {
    const notifications = await waitFor(async () => {
      const res = await request(app).get("/api/notifications").set(auth(owner));
      expect(res.status).toBe(200);
      const found = res.body.items.filter(
        (n: { type: string; reportId: number }) => n.type === "report_status_change" && n.reportId === lostReportId
      );
      return found.length > 0 ? found : undefined;
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe("Tu reporte fue publicado");
  });

  test("otro usuario publica el reporte de la mascota encontrada", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set(auth(finder))
      .send({
        reportType: "found",
        title: "Perra encontrada en Palermo",
        location: { lat: -34.581, lng: -58.421 },
        imageUrl: `${R2_PUBLIC_URL}/pets/e2e-found.jpg`,
      });

    expect(res.status).toBe(201);
    foundReportId = res.body.id;
    ctx.trackReport(foundReportId);

    await waitForReportStatus(app, foundReportId, "published", finder.token);
  });

  test("el backend registra el match y notifica al dueño", async () => {
    const match = await prisma.reportMatch.findUniqueOrThrow({
      where: { reportLostId_reportFoundId: { reportLostId: lostReportId, reportFoundId: foundReportId } },
    });
    expect(match.similarityScore).toBeCloseTo(1, 4);
    matchId = match.id;

    const matchNotification = await waitFor(async () => {
      const res = await request(app).get("/api/notifications").set(auth(owner));
      expect(res.status).toBe(200);
      return res.body.items.find(
        (n: { type: string; reportId: number }) => n.type === "match_suggested" && n.reportId === foundReportId
      );
    });
    expect(matchNotification.message).toContain("100% de similitud");
  });

  test("el dueño ve la coincidencia sugerida en su reporte", async () => {
    const res = await request(app).get(`/api/reports/${lostReportId}/matches`).set(auth(owner));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ matchId, reportId: foundReportId, status: "pending", reportType: "found" });
  });

  test("el dueño confirma la coincidencia", async () => {
    const res = await request(app).post(`/api/reports/${lostReportId}/matches/${matchId}/confirm`).set(auth(owner));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ matchId, status: "confirmed" });
    expect(res.body.confirmedAt).not.toBeNull();
  });

  test("el dueño cierra el reporte y queda resolved", async () => {
    const res = await request(app).post(`/api/reports/${lostReportId}/close`).set(auth(owner));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("resolved");

    const detail = await request(app).get(`/api/reports/${lostReportId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.status).toBe("resolved");
    expect(detail.body.tag.label).toBe("RESUELTO");
  });
});
