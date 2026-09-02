import { AddressInfo } from "net";
import { createServer, Server as HttpServer } from "http";
import request from "supertest";
import jwt from "jsonwebtoken";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { ChatServer, chatRoom, initChatSocket } from "../../src/sockets/chat.socket";

/**
 * Cobertura de la issue #141 (QA: Chat Real-time Integration Testing).
 *
 * Los casos de camino feliz (auth del handshake, A envía y B recibe, persistencia,
 * notificación al receptor, outsider rechazado) ya están en chat.socket.test.ts y
 * chats.routes.test.ts. Acá va lo que ninguna de las dos suites cubría y que la
 * issue pide explícitamente: reconexión, ausencia de leaks en los listeners,
 * carga de 100+ mensajes, orden bajo ráfaga, y el esquema de las imageUrl que
 * escribe el otro participante del chat.
 */

interface AckResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

const SUITE_TAG = `chat-realtime-${Date.now()}`;

describe("chat en tiempo real (#141)", () => {
  let httpServer: HttpServer;
  let io: ChatServer;
  let port: number;

  let userAId: number;
  let userBId: number;
  let tokenA: string;
  let tokenB: string;
  let chatId: number;

  const openSockets: ClientSocket[] = [];

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

  function waitForConnect(client: ClientSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      client.on("connect", () => resolve());
      client.on("connect_error", reject);
    });
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

  function waitForEvent<T>(client: ClientSocket, event: string): Promise<T> {
    return new Promise((resolve) => {
      client.once(event, resolve as (payload: T) => void);
    });
  }

  /** Espera hasta que `predicate` sea verdadero o se agote el tiempo. */
  async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
    const startedAt = Date.now();
    while (!predicate()) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error("waitUntil: se agotó el tiempo de espera");
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: { email: `${SUITE_TAG}-a@example.com`, passwordHash: "test-hash" },
    });
    userAId = userA.id;
    tokenA = jwt.sign({ sub: userA.id, email: userA.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const userB = await prisma.user.create({
      data: { email: `${SUITE_TAG}-b@example.com`, passwordHash: "test-hash" },
    });
    userBId = userB.id;
    tokenB = jwt.sign({ sub: userB.id, email: userB.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const chat = await prisma.chat.create({ data: { userAId, userBId } });
    chatId = chat.id;

    httpServer = createServer(app);
    io = initChatSocket(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    while (openSockets.length > 0) {
      openSockets.pop()!.close();
    }
    // Los tests de leak leen el estado del server; hay que esperar a que
    // procese las desconexiones antes de arrancar el siguiente caso.
    await waitUntil(() => io.engine.clientsCount === 0).catch(() => undefined);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    io.close();
    await prisma.message.deleteMany({ where: { chatId } });
    await prisma.notification.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.chat.delete({ where: { id: chatId } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.$disconnect();
  });

  describe("esquema de imageUrl", () => {
    // `z.string().url()` acepta cualquier esquema que el parser de URL de la
    // plataforma considere válido. Un imageUrl lo escribe el otro participante
    // del chat y el frontend lo mete en un <a href> y un <img src>, así que
    // sólo pueden pasar http y https.
    const peligrosas = [
      "javascript:alert(document.cookie)",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ];

    test.each(peligrosas)("el socket rechaza imageUrl con esquema %s", async (imageUrl) => {
      const client = connect({ auth: { token: tokenA } });
      await waitForConnect(client);

      const ack = await emitWithAck(client, "send_message", { chatId, imageUrl });

      expect(ack.ok).toBe(false);
      const persistido = await prisma.message.findFirst({ where: { chatId, imageUrl } });
      expect(persistido).toBeNull();
    });

    test.each(peligrosas)("POST /api/chats/:id/messages rechaza imageUrl %s", async (imageUrl) => {
      const res = await request(app)
        .post(`/api/chats/${chatId}/messages`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ imageUrl });

      expect(res.status).toBe(400);
      const persistido = await prisma.message.findFirst({ where: { chatId, imageUrl } });
      expect(persistido).toBeNull();
    });

    test("sigue aceptando una imageUrl https legítima", async () => {
      const imageUrl = `https://pub-test.r2.dev/chat/${SUITE_TAG}.jpg`;
      const client = connect({ auth: { token: tokenA } });
      await waitForConnect(client);

      const ack = await emitWithAck<{ imageUrl: string }>(client, "send_message", { chatId, imageUrl });

      expect(ack.ok).toBe(true);
      expect(ack.data?.imageUrl).toBe(imageUrl);
    });
  });

  describe("orden de los mensajes", () => {
    test("una ráfaga de 30 mensajes sin esperar ack llega completa y en orden", async () => {
      const clientA = connect({ auth: { token: tokenA } });
      const clientB = connect({ auth: { token: tokenB } });
      await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);
      await emitWithAck(clientB, "join_chat", { chatId });

      const TOTAL = 30;
      const prefijo = `rafaga-${Date.now()}`;
      const recibidos: string[] = [];
      clientB.on("receive_message", (message: { content: string | null }) => {
        if (message.content?.startsWith(prefijo)) recibidos.push(message.content);
      });

      const enviados = Array.from({ length: TOTAL }, (_, i) => `${prefijo}-${String(i).padStart(3, "0")}`);
      // Ráfaga real: se emiten todos de una y recién después se esperan los ack.
      const acks = enviados.map((content) => emitWithAck(clientA, "send_message", { chatId, content }));
      const resultados = await Promise.all(acks);
      expect(resultados.every((ack) => ack.ok)).toBe(true);

      await waitUntil(() => recibidos.length === TOTAL, 10000);
      expect(recibidos).toEqual(enviados);
    }, 30000);
  });

  describe("reconexión", () => {
    test("tras una caída de transporte el cliente vuelve solo y recibe mensajes de nuevo", async () => {
      const clientB = connect({
        auth: { token: tokenB },
        reconnection: true,
        reconnectionDelay: 50,
      });
      await waitForConnect(clientB);
      expect((await emitWithAck(clientB, "join_chat", { chatId })).ok).toBe(true);

      // Corta el transporte por debajo, como una caída de red real: el cliente
      // no llamó a disconnect(), así que socket.io tiene que reconectar solo.
      const reconnected = waitForEvent<number>(clientB, "connect");
      clientB.io.engine.close();
      await reconnected;
      expect(clientB.connected).toBe(true);

      // Al reconectar el socket es nuevo y las rooms del anterior se perdieron:
      // sin volver a join_chat no llega nada. Esto es exactamente lo que hace
      // useChatSocket cuando el status vuelve a 'connected'.
      expect((await emitWithAck(clientB, "join_chat", { chatId })).ok).toBe(true);

      const recibido = waitForEvent<{ content: string }>(clientB, "receive_message");
      const clientA = connect({ auth: { token: tokenA } });
      await waitForConnect(clientA);
      await emitWithAck(clientA, "send_message", { chatId, content: "después de reconectar" });

      expect((await recibido).content).toBe("después de reconectar");
    });

    test("los mensajes enviados durante la caída se recuperan del historial", async () => {
      const clientB = connect({ auth: { token: tokenB } });
      await waitForConnect(clientB);
      await emitWithAck(clientB, "join_chat", { chatId });

      // B se cae y A sigue escribiendo mientras tanto.
      clientB.close();
      await waitUntil(() => !clientB.connected);

      const contenido = `mensaje mientras B estaba caído ${Date.now()}`;
      const clientA = connect({ auth: { token: tokenA } });
      await waitForConnect(clientA);
      await emitWithAck(clientA, "send_message", { chatId, content: contenido });

      // El socket no reenvía lo perdido: la recuperación es por REST, que es lo
      // que hace useChatSocket invalidando la query al reconectar.
      const res = await request(app)
        .get(`/api/chats/${chatId}/messages`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.some((m: { content: string }) => m.content === contenido)).toBe(true);
    });
  });

  describe("listeners y rooms", () => {
    test("50 ciclos de conexión y desconexión no dejan sockets ni rooms colgados", async () => {
      const sala = chatRoom(chatId);
      const roomsAntes = io.sockets.adapter.rooms.size;

      for (let i = 0; i < 50; i++) {
        const client = ioc(`http://localhost:${port}`, {
          transports: ["websocket"],
          forceNew: true,
          reconnection: false,
          auth: { token: tokenA },
        });
        await waitForConnect(client);
        await emitWithAck(client, "join_chat", { chatId });
        client.close();
      }

      await waitUntil(() => io.engine.clientsCount === 0);
      await waitUntil(() => !io.sockets.adapter.rooms.has(sala));

      expect(io.sockets.sockets.size).toBe(0);
      expect(io.sockets.adapter.rooms.size).toBe(roomsAntes);
    }, 30000);

    test("leave_chat borra la room cuando sale el último socket", async () => {
      const sala = chatRoom(chatId);
      const client = connect({ auth: { token: tokenA } });
      await waitForConnect(client);

      await emitWithAck(client, "join_chat", { chatId });
      expect(io.sockets.adapter.rooms.get(sala)?.size).toBe(1);

      await emitWithAck(client, "leave_chat", { chatId });
      expect(io.sockets.adapter.rooms.has(sala)).toBe(false);
    });

    test("el server no acumula listeners al conectar y desconectar clientes", async () => {
      const listenersAntes = io.sockets.listenerCount("connection");

      for (let i = 0; i < 10; i++) {
        const client = connect({ auth: { token: tokenA } });
        await waitForConnect(client);
        client.close();
      }
      await waitUntil(() => io.engine.clientsCount === 0);

      expect(io.sockets.listenerCount("connection")).toBe(listenersAntes);
    });
  });

  describe("carga del historial", () => {
    test("el historial con 150 mensajes se sirve completo, ordenado y dentro del presupuesto", async () => {
      const TOTAL = 150;
      await prisma.message.createMany({
        data: Array.from({ length: TOTAL }, (_, i) => ({
          chatId,
          senderId: i % 2 === 0 ? userAId : userBId,
          content: `carga-${SUITE_TAG}-${String(i).padStart(4, "0")}`,
        })),
      });

      const inicio = Date.now();
      const res = await request(app)
        .get(`/api/chats/${chatId}/messages`)
        .set("Authorization", `Bearer ${tokenA}`);
      const duracion = Date.now() - inicio;

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(TOTAL);

      const deLaCarga = res.body.filter((m: { content: string | null }) =>
        m.content?.startsWith(`carga-${SUITE_TAG}-`)
      );
      expect(deLaCarga).toHaveLength(TOTAL);

      // Orden ascendente por fecha, que es lo que el frontend asume al pintar.
      const fechas = res.body.map((m: { createdAt: string }) => new Date(m.createdAt).getTime());
      expect(fechas).toEqual([...fechas].sort((a, b) => a - b));

      console.log(`[#141] GET /messages con ${res.body.length} mensajes: ${duracion}ms`);
      expect(duracion).toBeLessThan(2000);
    }, 30000);

    // El handler de send_message es async: hace await del insert en la base y
    // recién después emite a la room. Si se disparan varios envíos sin esperar
    // el ack anterior, los handlers corren solapados y el orden de emisión puede
    // no ser el de llegada. Importa porque el frontend appendea el mensaje al
    // final del array sin reordenar (appendMessage en useChatSocket).
  });

});
