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
    await prisma.notification.deleteMany({ where: { userId: { in: [userAId, userBId, outsiderId] } } });
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
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ reportId, participantId: userAId });

    expect(res.status).toBe(201);
    expect(res.body.userAId).toBe(Math.min(userAId, outsiderId));
    expect(res.body.userBId).toBe(Math.max(userAId, outsiderId));
    expect(res.body.reportId).toBe(reportId);
    createdChatIds.push(res.body.id);
  });

  test("POST /api/chats responde 200 con el chat existente si ya hay uno para ese reporte", async () => {
    const res = await request(app)
      .post("/api/chats")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ reportId, participantId: userAId });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(chatId);
    expect(res.body.reportId).toBe(reportId);
  });

  test("POST /api/chats responde 400 si participantId es el propio usuario", async () => {
    const res = await request(app)
      .post("/api/chats")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ reportId, participantId: userAId });
    expect(res.status).toBe(400);
  });

  test("POST /api/chats responde 403 si participantId no es el autor del reporte", async () => {
    const res = await request(app)
      .post("/api/chats")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ reportId, participantId: outsiderId });
    expect(res.status).toBe(403);
  });

  test("POST /api/chats responde 404 si el reporte no existe", async () => {
    const res = await request(app)
      .post("/api/chats")
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ reportId: 999999999, participantId: userAId });
    expect(res.status).toBe(404);
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

  test("POST /api/chats/:id/messages crea una notificación 'message' para el receptor y no para el emisor", async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: [userAId, userBId] }, type: "message" } });

    const res = await request(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ content: "¿la viste por el barrio?" });
    expect(res.status).toBe(201);

    const forRecipient = await prisma.notification.findMany({ where: { userId: userBId, type: "message" } });
    expect(forRecipient).toHaveLength(1);
    expect(forRecipient[0].reportId).toBe(reportId);
    expect(forRecipient[0].isRead).toBe(false);

    const forSender = await prisma.notification.findMany({ where: { userId: userAId, type: "message" } });
    expect(forSender).toHaveLength(0);
  });

  test("la notificación llega al otro participante aunque quien inició el chat quede como userB tras normalizar", async () => {
    const created = await request(app)
      .post("/api/chats")
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ reportId, participantId: userAId });
    expect(created.status).toBe(201);
    createdChatIds.push(created.body.id);
    await prisma.notification.deleteMany({ where: { userId: { in: [userAId, outsiderId] }, type: "message" } });

    const res = await request(app)
      .post(`/api/chats/${created.body.id}/messages`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ content: "creo que la vi" });
    expect(res.status).toBe(201);

    const forAuthor = await prisma.notification.findMany({ where: { userId: userAId, type: "message" } });
    expect(forAuthor).toHaveLength(1);
    const forSender = await prisma.notification.findMany({ where: { userId: outsiderId, type: "message" } });
    expect(forSender).toHaveLength(0);
  });

  test("POST /api/chats/:id/messages con imageUrl (sin content) persiste el mensaje y responde 201", async () => {
    const res = await request(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ imageUrl: "https://pub-test.r2.dev/chat/foto.jpg" });

    expect(res.status).toBe(201);
    expect(res.body.imageUrl).toBe("https://pub-test.r2.dev/chat/foto.jpg");
    expect(res.body.content).toBeNull();
  });

  test("POST /api/chats/:id/messages responde 400 si no manda ni content ni imageUrl", async () => {
    const res = await request(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test("POST /api/chats/:id/messages responde 400 si imageUrl no es una URL válida", async () => {
    const res = await request(app)
      .post(`/api/chats/${chatId}/messages`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ imageUrl: "no-es-una-url" });

    expect(res.status).toBe(400);
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
