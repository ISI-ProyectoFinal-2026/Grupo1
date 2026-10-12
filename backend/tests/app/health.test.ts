import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

describe("GET /health", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("responde 200 sin tocar la base (liveness)", async () => {
    const querySpy = jest.spyOn(prisma, "$queryRaw");

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(querySpy).not.toHaveBeenCalled();
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
