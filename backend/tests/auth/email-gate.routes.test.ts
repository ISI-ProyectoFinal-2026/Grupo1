import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";

// Qué rutas exigen el email verificado (y cuáles no). El gate va después de
// requireAuth: sin sesión es 401, con sesión sin verificar es 403.
const GATED_ROUTES = [
  { method: "post", path: "/api/reports" },
  { method: "post", path: "/api/uploads/presign" },
  { method: "post", path: "/api/uploads/analyze" },
  { method: "post", path: "/api/chats" },
  { method: "post", path: "/api/chats/1/messages" },
] as const;

describe("gate de email verificado", () => {
  let unverifiedId: number;
  let unverifiedToken: string;
  let verifiedId: number;
  let verifiedToken: string;

  beforeAll(async () => {
    const unverified = await createTestUser({ prefix: "email-gate-unverified", verified: false });
    unverifiedId = unverified.user.id;
    unverifiedToken = unverified.token;
    const verified = await createTestUser({ prefix: "email-gate-verified" });
    verifiedId = verified.user.id;
    verifiedToken = verified.token;
  });

  afterAll(async () => {
    await prisma.business.deleteMany({ where: { userId: unverifiedId } });
    await prisma.user.deleteMany({ where: { id: { in: [unverifiedId, verifiedId] } } });
    await prisma.$disconnect();
  });

  describe.each(GATED_ROUTES)("$method $path", ({ method, path }) => {
    test("responde 403 EMAIL_NOT_VERIFIED con la sesión sin verificar", async () => {
      const res = await request(app)[method](path).set("Authorization", `Bearer ${unverifiedToken}`).send({});

      expect(res.status).toBe(403);
      expect(res.body.error).toEqual(
        expect.objectContaining({
          message: "Tenés que verificar tu email para hacer esto",
          code: "EMAIL_NOT_VERIFIED",
        })
      );
    });

    test("con la sesión verificada pasa el gate (falla después por el body, no por el email)", async () => {
      const res = await request(app)[method](path).set("Authorization", `Bearer ${verifiedToken}`).send({});

      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    });

    test("responde 401 (no 403) con un JWT inválido", async () => {
      const res = await request(app)[method](path).set("Authorization", "Bearer no-es-un-jwt").send({});

      expect(res.status).toBe(401);
    });

    test("responde 401 sin token", async () => {
      const res = await request(app)[method](path).send({});

      expect(res.status).toBe(401);
    });
  });

  test("un usuario sin verificar sigue pudiendo reportar un reporte (flags no se gatean)", async () => {
    const res = await request(app)
      .post("/api/reports/2000000000/flags")
      .set("Authorization", `Bearer ${unverifiedToken}`)
      .send({ reason: "spam" });

    // El reporte no existe: lo que importa es que el gate de email no cortó antes.
    expect(res.body.error?.code).not.toBe("EMAIL_NOT_VERIFIED");
    expect(res.status).not.toBe(401);
  });

  test("un usuario sin verificar puede contactar a un comercio (no se gatea)", async () => {
    const res = await request(app)
      .post("/api/businesses/2000000000/contact")
      .set("Authorization", `Bearer ${unverifiedToken}`)
      .send({});

    expect(res.body.error?.code).not.toBe("EMAIL_NOT_VERIFIED");
    expect(res.status).not.toBe(401);
  });

  test("un JWT forjado con sub inexistente es 401 en una ruta gateada", async () => {
    const ghost = jwt.sign({ sub: 2_000_000_000, email: "x@example.com" }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const res = await request(app).post("/api/reports").set("Authorization", `Bearer ${ghost}`).send({});

    expect(res.status).toBe(401);
  });
});
