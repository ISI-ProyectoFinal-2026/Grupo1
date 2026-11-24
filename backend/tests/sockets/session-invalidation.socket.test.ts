import { AddressInfo } from "net";
import { createServer, Server as HttpServer } from "http";
import request from "supertest";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { issueAuthToken } from "../../src/services/auth-tokens.service";
import * as mailService from "../../src/services/mail.service";
import { initChatSocket } from "../../src/sockets/chat.socket";
import { codeFor, seedTwoFactor } from "../helpers/two-factor";
import { createTestUser } from "../helpers/users";

const PASSWORD = "Password123";
const RESET_WAIT_MS = 72 * 60 * 60 * 1000;

describe("chat.socket al invalidar la sesión", () => {
  let httpServer: HttpServer;
  let port: number;
  const userIds: number[] = [];
  const sockets: ClientSocket[] = [];

  const connect = (token: string) => {
    const client = ioc(`http://localhost:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      auth: { token },
    });
    sockets.push(client);
    return client;
  };
  const connected = (client: ClientSocket) =>
    new Promise<string>((resolve) => {
      client.on("connect", () => resolve("connect"));
      client.on("connect_error", (err) => resolve(err.message));
    });
  // abre un socket y expone la promesa del motivo de cierre
  const openSocket = async (token: string) => {
    const client = connect(token);
    expect(await connected(client)).toBe("connect");
    return { closed: new Promise<string>((resolve) => client.on("disconnect", resolve)) };
  };

  async function newUser(prefix: string) {
    const created = await createTestUser({ prefix, password: PASSWORD });
    userIds.push(created.user.id);
    return created;
  }
  async function twoFactorUser(prefix: string) {
    const created = await newUser(prefix);
    const seeded = await seedTwoFactor(created.user.id);
    return { ...created, ...seeded };
  }
  const post = (path: string, token: string, body: object) =>
    request(app).post(`/api/auth/2fa/${path}`).set("Authorization", `Bearer ${token}`).send(body);

  beforeAll(async () => {
    httpServer = createServer(app);
    initChatSocket(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
  });

  beforeEach(() => {
    for (const name of [
      "sendTwoFactorEnabled",
      "sendTwoFactorDisabled",
      "sendTwoFactorRecoveryCodeUsed",
      "sendTwoFactorResetCompleted",
    ] as const) {
      jest.spyOn(mailService, name).mockResolvedValue();
    }
  });

  afterEach(() => {
    while (sockets.length) sockets.pop()!.close();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  test("reset de contraseña desconecta el socket y el token viejo no reconecta", async () => {
    const { user, token } = await newUser("inv-sock-pwd");
    const { closed } = await openSocket(token);
    const resetToken = await issueAuthToken(user.id, "password_reset");

    const res = await request(app).post("/api/auth/reset-password").send({ token: resetToken, password: "NuevaClave456" });

    expect(res.status).toBe(200);
    expect(await closed).toBe("io server disconnect");
    expect(await connected(connect(token))).toBe("Tu sesión expiró, iniciá sesión de nuevo");
  });

  test("activar 2FA desconecta el socket", async () => {
    const { user, token } = await newUser("inv-sock-enable");
    const { secret } = await seedTwoFactor(user.id, { enabled: false });
    const { closed } = await openSocket(token);

    const res = await post("enable", token, { code: codeFor(secret) });

    expect(res.status).toBe(200);
    expect(await closed).toBe("io server disconnect");
  });

  test("desactivar 2FA desconecta el socket", async () => {
    const { token, secret } = await twoFactorUser("inv-sock-disable");
    const { closed } = await openSocket(token);

    const res = await post("disable", token, { password: PASSWORD, code: codeFor(secret) });

    expect(res.status).toBe(200);
    expect(await closed).toBe("io server disconnect");
  });

  test("regenerar códigos de recuperación desconecta el socket", async () => {
    const { token, secret } = await twoFactorUser("inv-sock-regen");
    const { closed } = await openSocket(token);

    const res = await post("recovery-codes", token, { code: codeFor(secret) });

    expect(res.status).toBe(200);
    expect(await closed).toBe("io server disconnect");
  });

  test("entrar con código de recuperación desconecta el socket", async () => {
    const { user, token, recoveryCodes } = await twoFactorUser("inv-sock-recovery");
    const { closed } = await openSocket(token);
    const login = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });

    const res = await request(app)
      .post("/api/auth/2fa/login")
      .send({ twoFactorToken: login.body.twoFactorToken, code: recoveryCodes[0] });

    expect(res.status).toBe(200);
    expect(await closed).toBe("io server disconnect");
  });

  test("completar el reinicio de 2FA desconecta el socket", async () => {
    const { user, token } = await twoFactorUser("inv-sock-reset");
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorResetRequestedAt: new Date(Date.now() - RESET_WAIT_MS - 60_000) },
    });
    const { closed } = await openSocket(token);

    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(await closed).toBe("io server disconnect");
  });
});
