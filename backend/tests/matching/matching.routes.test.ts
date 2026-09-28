import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

type MatchAction = "confirm" | "reject";

describe("confirmar y descartar coincidencias (#181)", () => {
  let lostOwnerId: number;
  let foundOwnerId: number;
  let strangerId: number;
  let lostOwnerToken: string;
  let foundOwnerToken: string;
  let strangerToken: string;

  let lostReportId: number;
  let foundReportId: number;
  let otherLostReportId: number;
  let otherFoundReportId: number;
  let matchId: number;

  const allReportIds = () => [lostReportId, foundReportId, otherLostReportId, otherFoundReportId];

  async function createUser(label: string) {
    return prisma.user.create({
      data: { email: `matching-routes-test-${label}-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
  }

  function tokenFor(user: { id: number; email: string }): string {
    return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });
  }

  async function createReport(userId: number, reportType: "lost" | "found", title: string): Promise<number> {
    const report = await prisma.report.create({ data: { userId, reportType, status: "published", title } });
    return report.id;
  }

  function decide(reportId: number, targetMatchId: number, action: MatchAction, token?: string) {
    const req = request(app).post(`/api/reports/${reportId}/matches/${targetMatchId}/${action}`);
    return token ? req.set("Authorization", `Bearer ${token}`) : req;
  }

  beforeAll(async () => {
    const lostOwner = await createUser("lost-owner");
    const foundOwner = await createUser("found-owner");
    const stranger = await createUser("stranger");
    lostOwnerId = lostOwner.id;
    foundOwnerId = foundOwner.id;
    strangerId = stranger.id;
    lostOwnerToken = tokenFor(lostOwner);
    foundOwnerToken = tokenFor(foundOwner);
    strangerToken = tokenFor(stranger);

    lostReportId = await createReport(lostOwnerId, "lost", "Perra perdida en Caballito");
    foundReportId = await createReport(foundOwnerId, "found", "Perra encontrada en Caballito");
    otherLostReportId = await createReport(strangerId, "lost", "Gato perdido en Flores");
    otherFoundReportId = await createReport(strangerId, "found", "Perra encontrada en Almagro");
  });

  beforeEach(async () => {
    const match = await prisma.reportMatch.create({
      data: { reportLostId: lostReportId, reportFoundId: foundReportId, similarityScore: 0.91 },
    });
    matchId = match.id;
  });

  afterEach(async () => {
    const ids = allReportIds();
    await prisma.reportMatch.deleteMany({
      where: { OR: [{ reportLostId: { in: ids } }, { reportFoundId: { in: ids } }] },
    });
  });

  afterAll(async () => {
    await prisma.report.deleteMany({ where: { id: { in: allReportIds() } } });
    await prisma.user.deleteMany({ where: { id: { in: [lostOwnerId, foundOwnerId, strangerId] } } });
    await prisma.$disconnect();
  });

  describe.each(["confirm", "reject"] as const)("POST /api/reports/:id/matches/:matchId/%s", (action) => {
    test("responde 401 sin token", async () => {
      const res = await decide(lostReportId, matchId, action);
      expect(res.status).toBe(401);
    });

    test("responde 400 si matchId no es numérico", async () => {
      const res = await request(app)
        .post(`/api/reports/${lostReportId}/matches/abc/${action}`)
        .set("Authorization", `Bearer ${lostOwnerToken}`);
      expect(res.status).toBe(400);
    });

    test("responde 404 si el reporte no existe", async () => {
      const res = await decide(999999999, matchId, action, lostOwnerToken);
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe("Reporte no encontrado");
    });

    test("responde 403 si quien actúa no participa del match", async () => {
      const res = await decide(lostReportId, matchId, action, strangerToken);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toBe("No tenés permiso para gestionar las coincidencias de este reporte");
    });

    test("responde 403 si el dueño del OTRO reporte actúa a través de un reporte que no es suyo", async () => {
      const res = await decide(lostReportId, matchId, action, foundOwnerToken);
      expect(res.status).toBe(403);

      const stored = await prisma.reportMatch.findUniqueOrThrow({ where: { id: matchId } });
      expect(stored.status).toBe("pending");
    });

    test("responde 404 si la coincidencia no existe", async () => {
      const res = await decide(lostReportId, 999999999, action, lostOwnerToken);
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe("Coincidencia no encontrada");
    });

    test("responde 404 si la coincidencia no involucra al reporte :id", async () => {
      const foreign = await prisma.reportMatch.create({
        data: { reportLostId: otherLostReportId, reportFoundId: foundReportId, similarityScore: 0.8 },
      });

      const res = await decide(lostReportId, foreign.id, action, lostOwnerToken);
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe("Coincidencia no encontrada");

      const stored = await prisma.reportMatch.findUniqueOrThrow({ where: { id: foreign.id } });
      expect(stored.status).toBe("pending");
    });
  });

  test("confirmar marca la coincidencia como confirmed y sella confirmedAt", async () => {
    const res = await decide(lostReportId, matchId, "confirm", lostOwnerToken);

    expect(res.status).toBe(200);
    const stored = await prisma.reportMatch.findUniqueOrThrow({ where: { id: matchId } });
    expect(stored.status).toBe("confirmed");
    expect(stored.confirmedAt).toBeInstanceOf(Date);
    expect(res.body).toEqual({ matchId, status: "confirmed", confirmedAt: stored.confirmedAt!.toISOString() });
  });

  test("el dueño del reporte found confirma a través de su propio reporte", async () => {
    const res = await decide(foundReportId, matchId, "confirm", foundOwnerToken);

    expect(res.status).toBe(200);
    const stored = await prisma.reportMatch.findUniqueOrThrow({ where: { id: matchId } });
    expect(stored.status).toBe("confirmed");
  });

  test("descartar marca la coincidencia como rejected sin sellar confirmedAt", async () => {
    const res = await decide(lostReportId, matchId, "reject", lostOwnerToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ matchId, status: "rejected", confirmedAt: null });
    const stored = await prisma.reportMatch.findUniqueOrThrow({ where: { id: matchId } });
    expect(stored.status).toBe("rejected");
    expect(stored.confirmedAt).toBeNull();
  });

  test("confirmar no resuelve ninguno de los dos reportes", async () => {
    await decide(lostReportId, matchId, "confirm", lostOwnerToken);

    const reports = await prisma.report.findMany({ where: { id: { in: [lostReportId, foundReportId] } } });
    expect(reports.map((report) => report.status)).toEqual(["published", "published"]);
  });

  test.each([
    ["confirm", "confirm", "La coincidencia ya fue confirmada"],
    ["confirm", "reject", "La coincidencia ya fue confirmada"],
    ["reject", "reject", "La coincidencia ya fue rechazada"],
    ["reject", "confirm", "La coincidencia ya fue rechazada"],
  ] as const)("tras %s, un %s posterior responde 409", async (first, second, message) => {
    const firstRes = await decide(lostReportId, matchId, first, lostOwnerToken);
    expect(firstRes.status).toBe(200);

    // El otro participante también choca con la decisión ya tomada.
    const res = await decide(foundReportId, matchId, second, foundOwnerToken);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(message);
  });

  test("dos decisiones concurrentes sobre la misma coincidencia: solo una gana", async () => {
    const [confirmRes, rejectRes] = await Promise.all([
      decide(lostReportId, matchId, "confirm", lostOwnerToken),
      decide(foundReportId, matchId, "reject", foundOwnerToken),
    ]);

    const statuses = [confirmRes.status, rejectRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = confirmRes.status === 200 ? confirmRes : rejectRes;
    const stored = await prisma.reportMatch.findUniqueOrThrow({ where: { id: matchId } });
    expect(stored.status).toBe(winner.body.status);
  });

  describe("GET /api/reports/:id/matches", () => {
    test("incluye matchId en cada coincidencia", async () => {
      const res = await request(app)
        .get(`/api/reports/${lostReportId}/matches`)
        .set("Authorization", `Bearer ${lostOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([expect.objectContaining({ matchId, reportId: foundReportId, status: "pending" })]);
    });

    test("omite las coincidencias descartadas para ambas partes", async () => {
      await prisma.reportMatch.create({
        data: { reportLostId: lostReportId, reportFoundId: otherFoundReportId, similarityScore: 0.99, status: "rejected" },
      });

      const fromLost = await request(app)
        .get(`/api/reports/${lostReportId}/matches`)
        .set("Authorization", `Bearer ${lostOwnerToken}`);
      expect(fromLost.status).toBe(200);
      expect(fromLost.body.map((match: { matchId: number }) => match.matchId)).toEqual([matchId]);

      const fromOtherFound = await request(app)
        .get(`/api/reports/${otherFoundReportId}/matches`)
        .set("Authorization", `Bearer ${strangerToken}`);
      expect(fromOtherFound.status).toBe(200);
      expect(fromOtherFound.body).toEqual([]);
    });

    test("sigue mostrando las confirmadas", async () => {
      await decide(lostReportId, matchId, "confirm", lostOwnerToken);

      const res = await request(app)
        .get(`/api/reports/${foundReportId}/matches`)
        .set("Authorization", `Bearer ${foundOwnerToken}`);

      expect(res.body).toEqual([expect.objectContaining({ matchId, reportId: lostReportId, status: "confirmed" })]);
    });
  });
});
