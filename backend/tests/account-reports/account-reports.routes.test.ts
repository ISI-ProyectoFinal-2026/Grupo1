import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as accountSanctionsService from "../../src/services/account-sanctions.service";
import { createTestUser } from "../helpers/users";

type Severity = "mild" | "moderate" | "severe";

describe("POST/GET /api/account-reports (#267)", () => {
  const userIds: number[] = [];
  let reported: { id: number; token: string };
  let reporters: { id: number; token: string }[];
  let moderatorToken: string;
  let thresholdSpy: jest.SpyInstance;

  async function newUser(prefix: string, role?: "moderador" | "admin") {
    const { user, token } = await createTestUser({ prefix, role });
    userIds.push(user.id);
    return { id: user.id, token };
  }

  function report(reporter: { token: string }, body: Record<string, unknown>) {
    return request(app).post("/api/account-reports").set("Authorization", `Bearer ${reporter.token}`).send(body);
  }

  beforeEach(async () => {
    thresholdSpy = jest.spyOn(accountSanctionsService, "onAccountReportThreshold").mockResolvedValue(undefined);
    reported = await newUser("account-reports-reported");
    reporters = [];
    for (let i = 0; i < 6; i++) reporters.push(await newUser(`account-reports-reporter-${i}`));
    moderatorToken = (await newUser("account-reports-mod", "moderador")).token;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("responde 401 sin sesión", async () => {
    const res = await request(app).post("/api/account-reports").send({ reportedUserId: reported.id, severity: "mild" });
    expect(res.status).toBe(401);
  });

  test("crea la denuncia con su gravedad y responde 201", async () => {
    const res = await report(reporters[0], { reportedUserId: reported.id, severity: "moderate" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ reportedUserId: reported.id, reporterId: reporters[0].id, severity: "moderate" });
  });

  test.each([
    [{ severity: "mild" }],
    [{ reportedUserId: 1 }],
    [{ reportedUserId: 1, severity: "grave" }],
  ])("responde 400 con un body inválido %j", async (body) => {
    const res = await report(reporters[0], body);
    expect(res.status).toBe(400);
  });

  test("responde 409 si la misma persona denuncia dos veces la cuenta", async () => {
    await report(reporters[0], { reportedUserId: reported.id, severity: "mild" });
    const res = await report(reporters[0], { reportedUserId: reported.id, severity: "severe" });

    expect(res.status).toBe(409);
    expect(await prisma.accountReport.count({ where: { reportedUserId: reported.id } })).toBe(1);
  });

  test("responde 403 al denunciar la propia cuenta", async () => {
    const res = await report(reported, { reportedUserId: reported.id, severity: "mild" });
    expect(res.status).toBe(403);
  });

  test("responde 404 si la cuenta no existe", async () => {
    const res = await report(reporters[0], { reportedUserId: 2_000_000_000, severity: "mild" });
    expect(res.status).toBe(404);
  });

  describe("umbral de 5 denuncias", () => {
    async function reportWith(severities: Severity[]) {
      for (const [i, severity] of severities.entries()) {
        const res = await report(reporters[i], { reportedUserId: reported.id, severity });
        expect(res.status).toBe(201);
      }
    }

    test("con 4 denuncias no se dispara la sanción", async () => {
      await reportWith(["severe", "severe", "severe", "severe"]);
      expect(thresholdSpy).not.toHaveBeenCalled();
    });

    test("la 5.ª denuncia dispara la sanción con la gravedad más frecuente", async () => {
      await reportWith(["mild", "severe", "mild", "moderate", "mild"]);

      expect(thresholdSpy).toHaveBeenCalledTimes(1);
      expect(thresholdSpy).toHaveBeenCalledWith(reported.id, "mild");
    });

    test("en empate dispara la sanción con la gravedad más alta", async () => {
      await reportWith(["mild", "moderate", "mild", "moderate", "severe"]);

      expect(thresholdSpy).toHaveBeenCalledWith(reported.id, "moderate");
    });

    test("una 6.ª denuncia no vuelve a disparar la sanción", async () => {
      await reportWith(["severe", "severe", "severe", "severe", "severe", "mild"]);
      expect(thresholdSpy).toHaveBeenCalledTimes(1);
    });

    test("denuncias simultáneas disparan la sanción una sola vez", async () => {
      await reportWith(["moderate", "moderate", "moderate"]);
      const results = await Promise.all(
        [3, 4, 5].map((i) => report(reporters[i], { reportedUserId: reported.id, severity: "moderate" }))
      );

      expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
      expect(thresholdSpy).toHaveBeenCalledTimes(1);
    });

    test("si el aviso a la sanción falla, la denuncia queda registrada igual", async () => {
      thresholdSpy.mockRejectedValue(new Error("boom"));
      jest.spyOn(console, "error").mockImplementation(() => {});
      await reportWith(["mild", "mild", "mild", "mild"]);

      const res = await report(reporters[4], { reportedUserId: reported.id, severity: "mild" });

      expect(res.status).toBe(201);
      expect(await prisma.accountReport.count({ where: { reportedUserId: reported.id } })).toBe(5);
    });
  });

  describe("GET /api/account-reports (moderación)", () => {
    test("responde 403 a un usuario regular", async () => {
      const res = await request(app).get("/api/account-reports").set("Authorization", `Bearer ${reporters[0].token}`);
      expect(res.status).toBe(403);
    });

    test("lista la cuenta con el conteo por gravedad y sin gravedad resultante antes del umbral", async () => {
      await report(reporters[0], { reportedUserId: reported.id, severity: "mild" });
      await report(reporters[1], { reportedUserId: reported.id, severity: "severe" });

      const res = await request(app).get("/api/account-reports").set("Authorization", `Bearer ${moderatorToken}`);

      expect(res.status).toBe(200);
      const entry = res.body.find((e: { reportedUser: { id: number } }) => e.reportedUser.id === reported.id);
      expect(entry).toMatchObject({
        reportCount: 2,
        severityCounts: { mild: 1, moderate: 0, severe: 1 },
        thresholdReached: false,
        resultingSeverity: null,
      });
      expect(entry.reportedUser).not.toHaveProperty("passwordHash");
    });

    test("al llegar al umbral informa la gravedad resultante", async () => {
      for (const [i, severity] of (["severe", "mild", "severe", "mild", "moderate"] as Severity[]).entries()) {
        await report(reporters[i], { reportedUserId: reported.id, severity });
      }

      const res = await request(app).get("/api/account-reports").set("Authorization", `Bearer ${moderatorToken}`);

      const entry = res.body.find((e: { reportedUser: { id: number } }) => e.reportedUser.id === reported.id);
      expect(entry).toMatchObject({ reportCount: 5, thresholdReached: true, resultingSeverity: "severe" });
    });
  });
});
