import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as mailService from "../../src/services/mail.service";

const PUBLIC_USER_KEYS = ["createdAt", "email", "emailVerifiedAt", "fullName", "id", "phone", "role", "updatedAt"];

describe("POST /api/auth/register and /api/auth/login", () => {
  const createdEmails: string[] = [];
  let verificationSpy: jest.SpyInstance;

  beforeEach(() => {
    verificationSpy = jest.spyOn(mailService, "sendEmailVerification").mockResolvedValue();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    while (createdEmails.length > 0) {
      const email = createdEmails.pop()!;
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function uniqueEmail(prefix: string): string {
    const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdEmails.push(email);
    return email;
  }

  describe("POST /api/auth/register", () => {
    test("responde 201 y crea el usuario sin exponer passwordHash", async () => {
      const email = uniqueEmail("routes-register");

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email, password: "Password123" });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe(email);
      expect(res.body).not.toHaveProperty("passwordHash");
    });

    test("devuelve el usuario público, sin verificar y sin datos internos de sesión", async () => {
      const email = uniqueEmail("routes-register-shape");

      const res = await request(app).post("/api/auth/register").send({ email, password: "Password123" });

      expect(Object.keys(res.body).sort()).toEqual(PUBLIC_USER_KEYS);
      expect(res.body).toEqual({
        id: expect.any(Number),
        email,
        fullName: null,
        phone: null,
        role: "usuario_regular",
        emailVerifiedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    test("manda el mail de verificación con un link al frontend", async () => {
      const email = uniqueEmail("routes-register-mail");

      await request(app).post("/api/auth/register").send({ email, password: "Password123" });

      expect(verificationSpy).toHaveBeenCalledTimes(1);
      const [to, link] = verificationSpy.mock.calls[0];
      expect(to).toBe(email);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      expect(link).toMatch(new RegExp(`^${frontendUrl}/verify-email\\?token=[A-Za-z0-9_-]{43}$`));
    });

    test("si falla el envío del mail el registro igual responde 201 (y lo loguea)", async () => {
      const email = uniqueEmail("routes-register-mail-fails");
      verificationSpy.mockRejectedValue(new Error("smtp caído"));
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app).post("/api/auth/register").send({ email, password: "Password123" });

      expect(res.status).toBe(201);
      expect(errorSpy).toHaveBeenCalled();
      expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
    });

    test("responde 409 con el envelope de error si el email ya está registrado", async () => {
      const email = uniqueEmail("routes-register-dup");
      await request(app).post("/api/auth/register").send({ email, password: "Password123" });

      const res = await request(app)
        .post("/api/auth/register")
        .send({ email, password: "Password123" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toBe("El email ya está registrado");
    });

    test("responde 400 con el envelope de error si el email tiene formato inválido", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "no-es-un-email", password: "Password123" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toBeDefined();
    });

    test("responde 400 si la contraseña es demasiado corta", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: uniqueEmail("routes-register-short"), password: "Aa1" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test("responde 400 si la contraseña no tiene mayúscula, minúscula y número", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: uniqueEmail("routes-register-weak"), password: "alllowercase" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("POST /api/auth/login", () => {
    test("responde 200 con un token cuando las credenciales son correctas", async () => {
      const email = uniqueEmail("routes-login-ok");
      await request(app).post("/api/auth/register").send({ email, password: "Password123" });

      const res = await request(app).post("/api/auth/login").send({ email, password: "Password123" });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe("string");
      expect(res.body.token.length).toBeGreaterThan(0);
      expect(res.body.user.email).toBe(email);
      expect(res.body.user).not.toHaveProperty("passwordHash");
      expect(Object.keys(res.body.user).sort()).toEqual(PUBLIC_USER_KEYS);
    });

    test("no bloquea el login de un usuario con el email sin verificar", async () => {
      const email = uniqueEmail("routes-login-unverified");
      await request(app).post("/api/auth/register").send({ email, password: "Password123" });

      const res = await request(app).post("/api/auth/login").send({ email, password: "Password123" });

      expect(res.status).toBe(200);
      expect(res.body.user.emailVerifiedAt).toBeNull();
    });

    test("responde 401 con el envelope de error si la contraseña es incorrecta", async () => {
      const email = uniqueEmail("routes-login-badpass");
      await request(app).post("/api/auth/register").send({ email, password: "Password123" });

      const res = await request(app).post("/api/auth/login").send({ email, password: "WrongPass1" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toBe("Credenciales inválidas");
    });

    test("responde 401 con el mismo mensaje genérico si el email no existe", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "jamas-existio@example.com", password: "WrongPass1" });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Credenciales inválidas");
    });
  });

  describe("GET /api/auth/me", () => {
    async function registerAndLogin(prefix: string) {
      const email = uniqueEmail(prefix);
      await request(app).post("/api/auth/register").send({ email, password: "Password123" });
      const login = await request(app).post("/api/auth/login").send({ email, password: "Password123" });
      return { email, token: login.body.token as string, userId: login.body.user.id as number };
    }

    test("devuelve el usuario público de la sesión", async () => {
      const { email, token, userId } = await registerAndLogin("routes-me");

      const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(PUBLIC_USER_KEYS);
      expect(res.body).toEqual(expect.objectContaining({ id: userId, email, emailVerifiedAt: null }));
    });

    test("sin token responde 401", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
    });

    test("con el token de un usuario borrado responde 401", async () => {
      const { token, userId } = await registerAndLogin("routes-me-deleted");
      await prisma.user.delete({ where: { id: userId } });

      const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Token inválido");
    });

    test("con un token de una versión de sesión vieja responde 401", async () => {
      const { token, userId } = await registerAndLogin("routes-me-stale");
      await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });

      const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Tu sesión expiró, iniciá sesión de nuevo");
    });

    test("los tokens viejos sin `tv` siguen valiendo mientras la versión sea 0", async () => {
      const { email, userId } = await registerAndLogin("routes-me-legacy");
      const legacy = jwt.sign({ sub: userId, email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

      const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${legacy}`);

      expect(res.status).toBe(200);
    });
  });
});
