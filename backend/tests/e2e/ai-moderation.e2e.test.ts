import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { NO_ANIMAL_DETECTED_MESSAGE } from "../../src/constants/moderation";
import { createE2EContext, E2EUser } from "./helpers/factories";
import { installAiStub, AiStub } from "./helpers/ai-stub";
import { waitFor, waitForReportStatus } from "./helpers/wait-for";

/**
 * Journeys B2-B4 (issue #39): qué pasa con un reporte con imagen según lo que
 * conteste el Backend IA. Todo va por HTTP real contra la app; el Backend IA se
 * simula con el stub sobre `fetch`.
 */
describe("E2E: moderación de imágenes con el Backend IA (B2-B4)", () => {
  const R2_PUBLIC_URL = "https://pub-e2e.r2.dev";
  const originalEnv = { ...process.env };
  const ctx = createE2EContext("ai-moderation");

  let ai: AiStub;
  let owner: E2EUser;

  const auth = (user: E2EUser) => ({ Authorization: `Bearer ${user.token}` });

  function postReport(user: E2EUser, title: string, imageName: string) {
    return request(app)
      .post("/api/reports")
      .set(auth(user))
      .send({
        reportType: "lost",
        title,
        location: { lat: -34.6, lng: -58.4 },
        imageUrl: `${R2_PUBLIC_URL}/pets/${imageName}`,
      });
  }

  beforeAll(async () => {
    process.env.R2_PUBLIC_URL = R2_PUBLIC_URL;
    process.env.AI_SERVICE_URL = "http://ai-e2e.test";
    process.env.INTERNAL_API_KEY = "e2e-internal-key";

    ai = installAiStub();
    owner = await ctx.registerAndLogin("owner");
  });

  beforeEach(() => {
    // Cada journey arranca con el Backend IA sano y sin llamadas previas.
    ai.respond("analyze", { status: 200, body: { has_animal: true } });
    ai.respond("embedding", { status: 201 });
    ai.calls.length = 0;
  });

  afterAll(async () => {
    ai.restore();
    process.env = { ...originalEnv };
    await ctx.cleanup();
    await prisma.$disconnect();
  });

  describe("B2: el Backend IA no detecta mascota al generar el embedding (422)", () => {
    let reportId: number;

    test("el reporte se crea pending y termina rejected", async () => {
      ai.respond("embedding", { status: 422, body: { detail: "no pet detected" } });

      const res = await postReport(owner, "Gato perdido en Caballito", "e2e-b2.jpg");
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("pending");
      reportId = res.body.id;
      ctx.trackReport(reportId);

      const report = await waitForReportStatus(app, reportId, "rejected", owner.token);
      expect(report.publishedAt).toBeNull();
      expect(ai.callsTo("embedding")).toHaveLength(1);
    });

    test("el reporte rechazado no es visible para la comunidad", async () => {
      const anonymous = await request(app).get(`/api/reports/${reportId}`);
      expect(anonymous.status).toBe(404);
    });

    test("el dueño recibe la notificación report_status_change de rechazo", async () => {
      const notifications = await waitFor(async () => {
        const res = await request(app).get("/api/notifications").set(auth(owner));
        expect(res.status).toBe(200);
        const found = res.body.filter(
          (n: { type: string; reportId: number }) => n.type === "report_status_change" && n.reportId === reportId
        );
        return found.length > 0 ? found : undefined;
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe("Tu reporte no fue publicado");
    });
  });

  describe("B3: el screening sincrónico no detecta ningún animal", () => {
    test("POST /reports responde 422 y no persiste nada", async () => {
      ai.respond("analyze", { status: 200, body: { has_animal: false } });
      const before = await prisma.report.count({ where: { userId: owner.id } });

      const res = await postReport(owner, "Foto de un auto", "e2e-b3.jpg");

      expect(res.status).toBe(422);
      expect(res.body.error.message).toBe(NO_ANIMAL_DETECTED_MESSAGE);
      expect(await prisma.report.count({ where: { userId: owner.id } })).toBe(before);
      expect(ai.callsTo("analyze")).toHaveLength(1);
      // Sin reporte no hay nada que moderar.
      expect(ai.callsTo("embedding")).toHaveLength(0);
    });
  });

  describe("B4: el Backend IA está caído", () => {
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
      // Los reintentos de matching.service esperan 1s y 5s con setTimeout: se
      // falsean solo los timers (no nextTick/setImmediate, que usan Prisma y
      // supertest) para recorrerlos sin esperar de verdad.
      jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
      consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      jest.useRealTimers();
      consoleError.mockRestore();
    });

    async function expectStaysPendingAfterRetries(title: string, imageName: string, finalLog: RegExp) {
      const res = await postReport(owner, title, imageName);

      // El usuario no queda bloqueado por la caída: el reporte se guarda igual.
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("pending");
      const reportId = res.body.id;
      ctx.trackReport(reportId);

      // Recorre todos los reintentos (1s + 5s) hasta que el servicio se rinde.
      await jest.advanceTimersByTimeAsync(40_000);

      expect(ai.callsTo("embedding")).toHaveLength(3);
      expect(consoleError.mock.calls.some(([message]) => finalLog.test(String(message)))).toBe(true);

      const stored = await prisma.report.findUniqueOrThrow({ where: { id: reportId } });
      expect(stored.status).toBe("pending");
      expect(stored.publishedAt).toBeNull();
      expect(
        await prisma.notification.count({ where: { reportId, type: "report_status_change" } })
      ).toBe(0);
    }

    test("con error de red: POST 201 y el reporte queda pending tras agotar los reintentos", async () => {
      ai.respond("analyze", { status: 0, networkError: true });
      ai.respond("embedding", { status: 0, networkError: true });

      await expectStaysPendingAfterRetries("Perro perdido sin IA (red)", "e2e-b4-red.jpg", /tras 3 intentos/);
    });

    test("con 500: POST 201 y el reporte queda pending tras agotar los reintentos", async () => {
      ai.respond("analyze", { status: 500 });
      ai.respond("embedding", { status: 500 });

      await expectStaysPendingAfterRetries("Perro perdido sin IA (500)", "e2e-b4-500.jpg", /respuesta inconclusa/);
    });
  });
});
