import { AddressInfo } from "net";
import { createServer, Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { initChatSocket } from "../../src/sockets/chat.socket";

interface AckResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

describe("chat.socket", () => {
  let httpServer: HttpServer;
  let port: number;

  let userAId: number;
  let userBId: number;
  let outsiderId: number;
  let chatId: number;
  let tokenA: string;
  let tokenB: string;
  let outsiderToken: string;

  const openSockets: ClientSocket[] = [];

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: { email: `chat-socket-test-a-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userAId = userA.id;
    tokenA = jwt.sign({ sub: userA.id, email: userA.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const userB = await prisma.user.create({
      data: { email: `chat-socket-test-b-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userBId = userB.id;
    tokenB = jwt.sign({ sub: userB.id, email: userB.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const outsider = await prisma.user.create({
      data: { email: `chat-socket-test-outsider-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    outsiderId = outsider.id;
    outsiderToken = jwt.sign({ sub: outsider.id, email: outsider.email }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });

    const chat = await prisma.chat.create({ data: { userAId, userBId } });
    chatId = chat.id;

    httpServer = createServer(app);
    initChatSocket(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(() => {
    while (openSockets.length > 0) {
      openSockets.pop()!.close();
    }
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await prisma.message.deleteMany({ where: { chatId } });
    await prisma.chat.delete({ where: { id: chatId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.user.delete({ where: { id: userBId } });
    await prisma.user.delete({ where: { id: outsiderId } });
    await prisma.$disconnect();
  });

  function connect(options: Parameters<typeof ioc>[1] = {}): ClientSocket {
    const client = ioc(`http://localhost:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      ...options,
    });
    openSockets.push(client);
    return client;
  }

  function emitWithAck<T = unknown>(
    client: ClientSocket,
    event: string,
    payload: Record<string, unknown>
  ): Promise<AckResponse<T>> {
    return new Promise((resolve) => {
      client.emit(event, payload, resolve);
    });
  }

  test("rechaza la conexión sin JWT", (done) => {
    const client = connect();
    client.on("connect_error", () => done());
    client.on("connect", () => done(new Error("no debería conectar sin token")));
  });

  test("rechaza la conexión con JWT inválido", (done) => {
    const client = connect({ auth: { token: "token-invalido" } });
    client.on("connect_error", () => done());
    client.on("connect", () => done(new Error("no debería conectar con token inválido")));
  });

  test("acepta la conexión con JWT válido en auth.token", (done) => {
    const client = connect({ auth: { token: tokenA } });
    client.on("connect", () => done());
    client.on("connect_error", (err) => done(err));
  });

  test("acepta la conexión con JWT válido en el header Authorization", (done) => {
    const client = connect({ extraHeaders: { Authorization: `Bearer ${tokenA}` } });
    client.on("connect", () => done());
    client.on("connect_error", (err) => done(err));
  });

  test("acepta la conexión con JWT válido en query.token", (done) => {
    const client = connect({ query: { token: tokenA } });
    client.on("connect", () => done());
    client.on("connect_error", (err) => done(err));
  });

  test("un mensaje enviado por A llega a B en tiempo real sin reload", async () => {
    const clientA = connect({ auth: { token: tokenA } });
    const clientB = connect({ auth: { token: tokenB } });

    await Promise.all([
      new Promise<void>((resolve) => clientA.on("connect", () => resolve())),
      new Promise<void>((resolve) => clientB.on("connect", () => resolve())),
    ]);

    const joinAck = await emitWithAck(clientB, "join_chat", { chatId });
    expect(joinAck.ok).toBe(true);

    const receivedByB = new Promise<{ content: string; senderId: number }>((resolve) => {
      clientB.on("receive_message", resolve);
    });

    const sendAck = await emitWithAck<{ content: string; senderId: number }>(clientA, "send_message", {
      chatId,
      content: "hola desde A",
    });
    expect(sendAck.ok).toBe(true);
    expect(sendAck.data?.content).toBe("hola desde A");

    const received = await receivedByB;
    expect(received.content).toBe("hola desde A");
    expect(received.senderId).toBe(userAId);
  });

  test("el mensaje enviado se persiste en la base de datos", async () => {
    const clientA = connect({ auth: { token: tokenA } });
    await new Promise<void>((resolve) => clientA.on("connect", () => resolve()));

    const ack = await emitWithAck<{ id: number }>(clientA, "send_message", {
      chatId,
      content: "mensaje persistido",
    });

    expect(ack.ok).toBe(true);
    const stored = await prisma.message.findUnique({ where: { id: ack.data!.id } });
    expect(stored).not.toBeNull();
    expect(stored?.content).toBe("mensaje persistido");
  });

  test("un usuario que no participa del chat no puede unirse ni enviar mensajes", async () => {
    const outsiderClient = connect({ auth: { token: outsiderToken } });
    await new Promise<void>((resolve) => outsiderClient.on("connect", () => resolve()));

    const joinAck = await emitWithAck(outsiderClient, "join_chat", { chatId });
    expect(joinAck.ok).toBe(false);

    const sendAck = await emitWithAck(outsiderClient, "send_message", { chatId, content: "intruso" });
    expect(sendAck.ok).toBe(false);
  });

  test("leave_chat saca al socket de la room del chat", async () => {
    const clientB = connect({ auth: { token: tokenB } });
    await new Promise<void>((resolve) => clientB.on("connect", () => resolve()));

    await emitWithAck(clientB, "join_chat", { chatId });
    const leaveAck = await emitWithAck(clientB, "leave_chat", { chatId });
    expect(leaveAck.ok).toBe(true);

    let receivedAfterLeave = false;
    clientB.on("receive_message", () => {
      receivedAfterLeave = true;
    });

    const clientA = connect({ auth: { token: tokenA } });
    await new Promise<void>((resolve) => clientA.on("connect", () => resolve()));
    await emitWithAck(clientA, "send_message", { chatId, content: "no debería llegar" });

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(receivedAfterLeave).toBe(false);
  });
});
