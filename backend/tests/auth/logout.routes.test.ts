import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as disconnectUser from "../../src/sockets/disconnect-user";

describe("POST /api/auth/logout", () => {
  const emails: string[] = [];
  let disconnectSpy: jest.SpyInstance;

  beforeEach(() => {
    disconnectSpy = jest.spyOn(disconnectUser, "disconnectUserSockets").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.user.deleteMany({ where: { email: { in: emails.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function session() {
    const email = `logout-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    emails.push(email);
    const password = "Password123";
    const reg = await request(app).post("/api/auth/register").send({ email, password });
    expect(reg.status).toBe(201);
    const login = await request(app).post("/api/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    return { userId: reg.body.id as number, token: login.body.token as string };
  }

  test("responde 204 y revoca el token", async () => {
    const { token } = await session();

    const res = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(401);
  });

  test("incrementa tokenVersion y desconecta los sockets del usuario", async () => {
    const { userId, token } = await session();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(after.tokenVersion).toBe(before.tokenVersion + 1);
    expect(disconnectSpy).toHaveBeenCalledWith(userId);
  });

  test("sin token responde 401 y no desconecta nada", async () => {
    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(401);
    expect(disconnectSpy).not.toHaveBeenCalled();
  });
});
