import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

describe("POST /api/auth/register and /api/auth/login", () => {
  const createdEmails: string[] = [];

  afterEach(async () => {
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
});
