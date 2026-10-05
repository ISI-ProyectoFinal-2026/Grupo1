import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createE2EContext, E2EUser } from "./helpers/factories";

/**
 * Journey B6 (issue #39): los caminos de error del ciclo de vida. Cierre y
 * decisión sobre coincidencias son solo del dueño, no se repiten, y el
 * endpoint interno que usa backend-ia exige X-Internal-Key.
 *
 * Los matches se insertan con Prisma: los crea el Backend IA en Python, Node
 * nunca los genera (mismo atajo que en report-lifecycle.e2e.test.ts).
 */
describe("E2E: errores del ciclo de vida de un reporte (B6)", () => {
  const INTERNAL_API_KEY = "e2e-internal-key";
  const originalInternalKey = process.env.INTERNAL_API_KEY;
  const ctx = createE2EContext("lifecycle-errors");

  let owner: E2EUser;
  let finder: E2EUser;
  let stranger: E2EUser;
  let lostReportId: number;
  let foundReportId: number;
  let strangerLostReportId: number;
  let matchId: number;
  let foreignMatchId: number;

  const auth = (user: E2EUser) => ({ Authorization: `Bearer ${user.token}` });

  // Sin imagen el reporte nace published: no hace falta el Backend IA.
  async function createReport(user: E2EUser, reportType: "lost" | "found", title: string): Promise<number> {
    const res = await request(app)
      .post("/api/reports")
      .set(auth(user))
      .send({ reportType, title, location: { lat: -34.6, lng: -58.38 } });
    expect(res.status).toBe(201);
    ctx.trackReport(res.body.id);
    return res.body.id;
  }

  beforeAll(async () => {
    process.env.INTERNAL_API_KEY = INTERNAL_API_KEY;

    owner = await ctx.registerAndLogin("owner");
    finder = await ctx.registerAndLogin("finder");
    stranger = await ctx.registerAndLogin("stranger");

    lostReportId = await createReport(owner, "lost", "Gata perdida en Recoleta");
    foundReportId = await createReport(finder, "found", "Gata encontrada en Recoleta");
    strangerLostReportId = await createReport(stranger, "lost", "Gato perdido en Belgrano");

    matchId = (
      await prisma.reportMatch.create({
        data: { reportLostId: lostReportId, reportFoundId: foundReportId, similarityScore: 0.88 },
      })
    ).id;
    // Coincidencia en la que el reporte del dueño no participa.
    foreignMatchId = (
      await prisma.reportMatch.create({
        data: { reportLostId: strangerLostReportId, reportFoundId: foundReportId, similarityScore: 0.75 },
      })
    ).id;
  });

  afterAll(async () => {
    if (originalInternalKey === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = originalInternalKey;
    await ctx.cleanup();
    await prisma.$disconnect();
  });

  describe("coincidencias", () => {
    test("confirmar una coincidencia ajena al reporte responde 404", async () => {
      const res = await request(app)
        .post(`/api/reports/${lostReportId}/matches/${foreignMatchId}/confirm`)
        .set(auth(owner));

      expect(res.status).toBe(404);
    });

    test("quien no es dueño del reporte no puede confirmar la coincidencia (403)", async () => {
      // El finder participa del match con su reporte "found", pero la ruta es
      // sobre el reporte del dueño.
      const res = await request(app).post(`/api/reports/${lostReportId}/matches/${matchId}/confirm`).set(auth(finder));

      expect(res.status).toBe(403);
    });

    test("decidir dos veces la misma coincidencia responde 409", async () => {
      const reject = await request(app).post(`/api/reports/${lostReportId}/matches/${matchId}/reject`).set(auth(owner));
      expect(reject.status).toBe(200);
      expect(reject.body).toMatchObject({ matchId, status: "rejected" });

      const confirm = await request(app)
        .post(`/api/reports/${lostReportId}/matches/${matchId}/confirm`)
        .set(auth(owner));
      expect(confirm.status).toBe(409);

      const stored = await prisma.reportMatch.findUniqueOrThrow({ where: { id: matchId } });
      expect(stored.status).toBe("rejected");
    });
  });

  describe("endpoint interno de notificación de match", () => {
    const payload = () => ({ lostReportId, foundReportId, similarityScore: 0.88 });

    test("sin X-Internal-Key responde 401", async () => {
      const res = await request(app).post("/api/notifications/internal/match").send(payload());

      expect(res.status).toBe(401);
    });

    test("con una X-Internal-Key incorrecta responde 401", async () => {
      const res = await request(app)
        .post("/api/notifications/internal/match")
        .set("X-Internal-Key", "clave-equivocada")
        .send(payload());

      expect(res.status).toBe(401);
    });

    test("ninguno de los intentos rechazados generó notificaciones", async () => {
      expect(await prisma.notification.count({ where: { type: "match_suggested", userId: owner.id } })).toBe(0);
    });
  });

  describe("cierre del reporte", () => {
    test("quien no es dueño no puede cerrarlo (403)", async () => {
      const res = await request(app).post(`/api/reports/${lostReportId}/close`).set(auth(finder));

      expect(res.status).toBe(403);
      const stored = await prisma.report.findUniqueOrThrow({ where: { id: lostReportId } });
      expect(stored.status).toBe("published");
    });

    test("cerrarlo dos veces responde 409", async () => {
      const first = await request(app).post(`/api/reports/${lostReportId}/close`).set(auth(owner));
      expect(first.status).toBe(200);
      expect(first.body.status).toBe("resolved");

      const second = await request(app).post(`/api/reports/${lostReportId}/close`).set(auth(owner));
      expect(second.status).toBe(409);
    });
  });
});
