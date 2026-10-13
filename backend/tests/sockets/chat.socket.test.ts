import { AddressInfo } from "net";
import { createServer, Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";
import { initChatSocket } from "../../src/sockets/chat.socket";

interface AckResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

describe("chat.socket", () => {
  let httpServer: HttpServer;
  let port: number;

  let userAId: number;
  let userBId: number;
  let outsiderId: number;
  let unverifiedId: number;
  let unverifiedChatId: number;
  let chatId: number;
  let tokenA: string;
  let tokenB: string;
  let outsiderToken: string;
  let unverifiedToken: string;

  const openSockets: ClientSocket[] = [];

  beforeAll(async () => {
    const userA = await createTestUser({ prefix: "chat-socket-test-a" });
    userAId = userA.user.id;
    tokenA = userA.token;

    const userB = await createTestUser({ prefix: "chat-socket-test-b" });
    userBId = userB.user.id;
    tokenB = userB.token;

    const outsider = await createTestUser({ prefix: "chat-socket-test-outsider" });
    outsiderId = outsider.user.id;
    outsiderToken = outsider.token;

    const unverified = await createTestUser({ prefix: "chat-socket-test-unverified", verified: false });
    unverifiedId = unverified.user.id;
    unverifiedToken = unverified.token;

    const chat = await prisma.chat.create({ data: { userAId, userBId } });
    chatId = chat.id;
    const unverifiedChat = await prisma.chat.create({ data: { userAId: unverifiedId, userBId } });
    unverifiedChatId = unverifiedChat.id;

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
    await prisma.message.deleteMany({ where: { chatId: { in: [chatId, unverifiedChatId] } } });
    await prisma.notification.deleteMany({ where: { userId: { in: [userAId, userBId, outsiderId, unverifiedId] } } });
    await prisma.chat.deleteMany({ where: { id: { in: [chatId, unverifiedChatId] } } });
    await prisma.user.delete({ where: { id: unverifiedId } });
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

  test("rechaza la conexión con un JWT de una versión de sesión vieja", async () => {
    const stale = await prisma.user.create({
      data: {
        email: `chat-socket-test-stale-${Date.now()}@example.com`,
        passwordHash: "test-hash",
        tokenVersion: 1,
      },
    });
    // Token emitido antes del cambio de contraseña: sin `tv` cuenta como versión 0.
    const staleToken = jwt.sign({ sub: stale.id, email: stale.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    try {
      const client = connect({ auth: { token: staleToken } });
      const outcome = await new Promise<string>((resolve) => {
        client.on("connect_error", (err) => resolve(err.message));
        client.on("connect", () => resolve("conectó"));
      });

      expect(outcome).toBe("Tu sesión expiró, iniciá sesión de nuevo");
    } finally {
      await prisma.user.delete({ where: { id: stale.id } });
    }
  });

  test("rechaza la conexión con el JWT de un usuario que ya no existe", async () => {
    const ghostToken = jwt.sign({ sub: 2_000_000_000, email: "fantasma@example.com" }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });

    const client = connect({ auth: { token: ghostToken } });
    const outcome = await new Promise<string>((resolve) => {
      client.on("connect_error", (err) => resolve(err.message));
      client.on("connect", () => resolve("conectó"));
    });

    expect(outcome).toBe("Token inválido");
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

  test("un mensaje enviado con imageUrl (sin content) llega y se persiste", async () => {
    const clientA = connect({ auth: { token: tokenA } });
    const clientB = connect({ auth: { token: tokenB } });

    await Promise.all([
      new Promise<void>((resolve) => clientA.on("connect", () => resolve())),
      new Promise<void>((resolve) => clientB.on("connect", () => resolve())),
    ]);
    await emitWithAck(clientB, "join_chat", { chatId });

    const receivedByB = new Promise<{ imageUrl: string | null; content: string | null }>((resolve) => {
      clientB.on("receive_message", resolve);
    });

    const sendAck = await emitWithAck<{ id: number; imageUrl: string | null }>(clientA, "send_message", {
      chatId,
      imageUrl: "https://pub-test.r2.dev/chat/foto.jpg",
    });
    expect(sendAck.ok).toBe(true);
    expect(sendAck.data?.imageUrl).toBe("https://pub-test.r2.dev/chat/foto.jpg");

    const received = await receivedByB;
    expect(received.imageUrl).toBe("https://pub-test.r2.dev/chat/foto.jpg");
    expect(received.content).toBeNull();

    const stored = await prisma.message.findUnique({ where: { id: sendAck.data!.id } });
    expect(stored?.imageUrl).toBe("https://pub-test.r2.dev/chat/foto.jpg");
  });

  test("rechaza send_message sin content ni imageUrl", async () => {
    const clientA = connect({ auth: { token: tokenA } });
    await new Promise<void>((resolve) => clientA.on("connect", () => resolve()));

    const ack = await emitWithAck(clientA, "send_message", { chatId });
    expect(ack.ok).toBe(false);
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

  test("un mensaje enviado por socket crea una notificación 'message' para el receptor", async () => {
    await prisma.notification.deleteMany({ where: { userId: userBId, type: "message" } });

    const clientA = connect({ auth: { token: tokenA } });
    await new Promise<void>((resolve) => clientA.on("connect", () => resolve()));

    const ack = await emitWithAck<{ id: number }>(clientA, "send_message", {
      chatId,
      content: "te aviso por acá",
    });
    expect(ack.ok).toBe(true);

    const forRecipient = await prisma.notification.findMany({ where: { userId: userBId, type: "message" } });
    expect(forRecipient).toHaveLength(1);
    expect(forRecipient[0].isRead).toBe(false);
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

  describe("send_message con el email sin verificar", () => {
    test("acepta la conexión y el join_chat (el handshake es solo de sesión)", async () => {
      const client = connect({ auth: { token: unverifiedToken } });
      await new Promise<void>((resolve, reject) => {
        client.on("connect", () => resolve());
        client.on("connect_error", reject);
      });

      const joinAck = await emitWithAck(client, "join_chat", { chatId: unverifiedChatId });
      expect(joinAck.ok).toBe(true);
    });

    test("rechaza con code EMAIL_NOT_VERIFIED, emite `error`, no persiste ni difunde", async () => {
      const sender = connect({ auth: { token: unverifiedToken } });
      const receiver = connect({ auth: { token: tokenB } });
      await Promise.all([
        new Promise<void>((resolve) => sender.on("connect", () => resolve())),
        new Promise<void>((resolve) => receiver.on("connect", () => resolve())),
      ]);
      await emitWithAck(receiver, "join_chat", { chatId: unverifiedChatId });

      let broadcasted = false;
      receiver.on("receive_message", () => {
        broadcasted = true;
      });
      const errorEvent = new Promise<{ event: string; message: string; code?: string }>((resolve) => {
        sender.on("error", resolve);
      });

      const ack = await emitWithAck(sender, "send_message", { chatId: unverifiedChatId, content: "hola" });

      expect(ack).toEqual({
        ok: false,
        error: "Tenés que verificar tu email para hacer esto",
        code: "EMAIL_NOT_VERIFIED",
      });
      await expect(errorEvent).resolves.toEqual({
        event: "send_message",
        message: "Tenés que verificar tu email para hacer esto",
        code: "EMAIL_NOT_VERIFIED",
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(broadcasted).toBe(false);
      expect(await prisma.message.count({ where: { chatId: unverifiedChatId } })).toBe(0);
    });

    test("verificar a mitad de sesión surte efecto en el mismo socket, y la cadena de envíos sigue viva", async () => {
      const client = connect({ auth: { token: unverifiedToken } });
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));

      const rejected = await emitWithAck(client, "send_message", { chatId: unverifiedChatId, content: "uno" });
      expect(rejected.code).toBe("EMAIL_NOT_VERIFIED");

      await prisma.user.update({ where: { id: unverifiedId }, data: { emailVerifiedAt: new Date() } });

      const accepted = await emitWithAck<{ content: string }>(client, "send_message", {
        chatId: unverifiedChatId,
        content: "dos",
      });
      expect(accepted.ok).toBe(true);
      expect(accepted.data?.content).toBe("dos");
      await prisma.user.update({ where: { id: unverifiedId }, data: { emailVerifiedAt: null } });
    });
  });
});
