import { AddressInfo } from "net";
import { createServer, Server as HttpServer } from "http";
import request from "supertest";
import jwt from "jsonwebtoken";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { initChatSocket } from "../../src/sockets/chat.socket";

describe("/api/chats", () => {
  let userAId: number;
  let userBId: number;
  let outsiderId: number;
  let tokenA: string;
  let tokenB: string;
  let outsiderToken: string;
  let reportId: number;
  let chatId: number;

  const createdChatIds: number[] = [];

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: { email: `chats-routes-test-a-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userAId = userA.id;
    tokenA = jwt.sign({ sub: userA.id, email: userA.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const userB = await prisma.user.create({
      data: { email: `chats-routes-test-b-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userBId = userB.id;
    tokenB = jwt.sign({ sub: userB.id, email: userB.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const outsider = await prisma.user.create({
      data: { email: `chats-routes-test-outsider-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    outsiderId = outsider.id;
    outsiderToken = jwt.sign({ sub: outsider.id, email: outsider.email }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });

    const report = await prisma.report.create({
      data: { userId: userAId, reportType: "lost", title: "Perro perdido" },
    });
    reportId = report.id;

    const chat = await prisma.chat.create({ data: { userAId, userBId, reportId } });
    chatId = chat.id;
  });

  afterEach(async () => {
    while (createdChatIds.length > 0) {
      const id = createdChatIds.pop()!;
      await prisma.message.deleteMany({ where: { chatId: id } });
      await prisma.chat.deleteMany({ where: { id } });
    }
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { chatId } });
    await prisma.chat.delete({ where: { id: chatId } });
    await prisma.report.delete({ where: { id: reportId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.user.delete({ where: { id: userBId } });
    await prisma.user.delete({ where: { id: outsiderId } });
    await prisma.$disconnect();
  });

  test("GET /api/chats sin token responde 401", async () => {
    const res = await request(app).get("/api/chats");
    expect(res.status).toBe(401);
  });

  test("GET /api/chats devuelve los chats del usuario autenticado", async () => {
    const res = await request(app).get("/api/chats").set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.some((c: { id: number }) => c.id === chatId)).toBe(true);
  });

  test("POST /api/chats crea el chat y responde 201 con el objeto creado", async () => {
    const res = await request(app)
      .post("/api/chats")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ reportId, participantId: outsiderId });

    expect(res.status).toBe(201);
    expect(res.body.userAId).toBe(userAId);
    expect(res.body.userBId).toBe(outsiderId);
    expect(res.body.reportId).toBe(reportId);
    createdChatIds.push(res.body.id);
  });

  test("POST /api/chats sin token responde 401", async () => {
    const res = await request(app).post("/api/chats").send({ reportId, participantId: outsiderId });
    expect(res.status).toBe(401);
  });

  test("POST /api/chats responde 400 si el body es inválido", async () => {
    const res = await request(app)
      .post("/api/chats")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ participantId: outsiderId });
    expect(res.status).toBe(400);
  });

  test("GET /api/chats/:id/messages devuelve el historial ordenado por fecha de creación", async () => {
    const first = await prisma.message.create({ data: { chatId, senderId: userAId, content: "primero" } });
    const second = await prisma.message.create({ data: { chatId, senderId: userBId, content: "segundo" } });

    const res = await request(app).get(`/api/chats/${chatId}/messages`).set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((m: { id: number }) => m.id);
    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id));
  });

  test("GET /api/chats/:id/messages responde 403 si el usuario no participa del chat", async () => {
    const res = await request(app)
      .get(`/api/chats/${chatId}/messages`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  test("POST /api/chats/:id/messages persiste el mensaje y responde 201", async () => {
    const res = await request(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ content: "hola" });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe("hola");
    expect(res.body.senderId).toBe(userAId);

    const stored = await prisma.message.findUnique({ where: { id: res.body.id } });
    expect(stored).not.toBeNull();
  });

  test("POST /api/chats/:id/messages responde 403 si el usuario no participa del chat", async () => {
    const res = await request(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ content: "intruso" });
    expect(res.status).toBe(403);
  });

  describe("emisión por Socket.io", () => {
    let httpServer: HttpServer;
    let port: number;
    let client: ClientSocket;

    beforeAll(async () => {
      httpServer = createServer(app);
      initChatSocket(httpServer);
      await new Promise<void>((resolve) => httpServer.listen(0, resolve));
      port = (httpServer.address() as AddressInfo).port;
    });

    afterAll(async () => {
      client?.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    });

    test("POST /api/chats/:id/messages emite receive_message a los participantes conectados", async () => {
      client = ioc(`http://localhost:${port}`, {
        transports: ["websocket"],
        forceNew: true,
        reconnection: false,
        auth: { token: tokenB },
      });
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));
      await new Promise<void>((resolve) => client.emit("join_chat", { chatId }, () => resolve()));

      const received = new Promise<{ content: string }>((resolve) => {
        client.on("receive_message", resolve);
      });

      const res = await request(app)
        .post(`/api/chats/${chatId}/messages`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ content: "vía REST" });

      expect(res.status).toBe(201);
      const message = await received;
      expect(message.content).toBe("vía REST");
    });
  });
});
