import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createTestUser } from "./users";

describe("createTestUser", () => {
  const createdIds: number[] = [];

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  });

  test("creates a verified user and a token that requireAuth accepts", async () => {
    const { user, token } = await createTestUser({ prefix: "helper-verified" });
    createdIds.push(user.id);

    expect(user.email).toMatch(/^helper-verified-.+@example\.com$/);
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });

  test("creates an unverified user with the requested role when asked", async () => {
    const { user, token } = await createTestUser({ prefix: "helper-unverified", verified: false, role: "moderador" });
    createdIds.push(user.id);

    expect(user.emailVerifiedAt).toBeNull();
    expect(user.role).toBe("moderador");

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.emailVerifiedAt).toBeNull();
  });

  test("returns a different email for every call with the same prefix", async () => {
    const a = await createTestUser({ prefix: "helper-unique" });
    const b = await createTestUser({ prefix: "helper-unique" });
    createdIds.push(a.user.id, b.user.id);

    expect(a.user.email).not.toBe(b.user.email);
    expect(a.user.id).not.toBe(b.user.id);
  });

  test("con `password` guarda un hash bcrypt que valida esa contraseña (y solo esa)", async () => {
    const { user } = await createTestUser({ prefix: "helper-password", password: "Clave1234" });
    createdIds.push(user.id);

    await expect(bcrypt.compare("Clave1234", user.passwordHash)).resolves.toBe(true);
    await expect(bcrypt.compare("OtraClave99", user.passwordHash)).resolves.toBe(false);
  });

  test("sin `password` conserva el hash de relleno", async () => {
    const { user } = await createTestUser({ prefix: "helper-nopassword" });
    createdIds.push(user.id);

    expect(user.passwordHash).toBe("test-hash");
  });
});
