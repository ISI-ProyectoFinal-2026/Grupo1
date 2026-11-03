import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

describe("GET /health", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test("responde 200 sin tocar la base ni el Backend IA (liveness)", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    const querySpy = jest.spyOn(prisma, "$queryRaw");
    const fetchSpy = jest.spyOn(global, "fetch");

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", ai: "configured" });
    expect(querySpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("informa el Backend IA como no configurado sin AI_SERVICE_URL (#220)", async () => {
    delete process.env.AI_SERVICE_URL;

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", ai: "not_configured" });
  });

  test("GET /health/ai responde 503 not_configured sin AI_SERVICE_URL", async () => {
    delete process.env.AI_SERVICE_URL;

    const res = await request(app).get("/health/ai");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "not_configured" });
  });

  test("GET /health/ai responde 200 cuando el Backend IA contesta", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200 } as Response);

    const res = await request(app).get("/health/ai");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  test("GET /health/ai responde 503 cuando el Backend IA no contesta", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("fetch failed"));

    const res = await request(app).get("/health/ai");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "unavailable" });
  });

  test("GET /health/db responde 200 cuando la base contesta (readiness)", async () => {
    jest.spyOn(prisma, "$queryRaw").mockResolvedValue([{ "?column?": 1 }]);

    const res = await request(app).get("/health/db");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  test("GET /health/db responde 503 cuando la base no contesta", async () => {
    jest.spyOn(prisma, "$queryRaw").mockRejectedValue(new Error("connection refused"));

    const res = await request(app).get("/health/db");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "unavailable" });
  });
});

describe("headers de seguridad (helmet)", () => {
  test.each(["/health", "/api/ruta-inexistente"])("%s trae los headers de helmet", async (path) => {
    const res = await request(app).get(path);

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
