import { AddressInfo } from "net";
import { createServer, Server as HttpServer } from "http";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as accountReportsService from "../../src/services/account-reports.service";
import { sanctionClock } from "../../src/services/account-sanctions/clock";
import { initChatSocket } from "../../src/sockets/chat.socket";
import { signAccessToken } from "../../src/utils/jwt";
import { createTestUser } from "../helpers/users";

interface Ack {
  ok: boolean;
  error?: string;
  code?: string;
}

describe("chat.socket con cuenta suspendida", () => {
  let httpServer: HttpServer;
  let port: number;
  let userId: number;
  let token: string;
  let otherId: number;
  let chatId: number;
  const reporterIds: number[] = [];
  const sockets: ClientSocket[] = [];

  const connect = (auth: { token: string }) => {
    const client = ioc(`http://localhost:${port}`, { transports: ["websocket"], forceNew: true, reconnection: false, auth });
    sockets.push(client);
    return client;
  };
  const connected = (client: ClientSocket) =>
    new Promise<string>((resolve) => {
      client.on("connect", () => resolve("connect"));
      client.on("connect_error", (err) => resolve(err.message));
    });
  const ack = (client: ClientSocket, event: string, payload: object) =>
    new Promise<Ack>((resolve) => client.emit(event, payload, resolve));
  const suspend = async (target: number) => {
    await prisma.accountSanction.create({
      data: {
        userId: target,
        severity: "mild",
        kind: "temporary",
        status: "active",
        reason: "x",
        triggeringReportIds: [],
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600_000),
      },
    });
    await prisma.user.update({ where: { id: target }, data: { tokenVersion: { increment: 1 } } });
  };

  beforeAll(async () => {
    const user = await createTestUser({ prefix: "susp-sock" });
    userId = user.user.id;
    token = user.token;
    otherId = (await createTestUser({ prefix: "susp-sock-other" })).user.id;
    chatId = (await prisma.chat.create({ data: { userAId: userId, userBId: otherId } })).id;
    httpServer = createServer(app);
    initChatSocket(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(() => {
    while (sockets.length) sockets.pop()!.close();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    const ids = [userId, otherId, ...reporterIds];
    await prisma.message.deleteMany({ where: { chatId } });
    await prisma.chat.deleteMany({ where: { id: chatId } });
    await prisma.accountReport.deleteMany({ where: { reportedUserId: { in: ids } } });
    await prisma.accountSanctionEvent.deleteMany({ where: { sanction: { userId: { in: ids } } } });
    await prisma.accountSanction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  test("send_message y join_chat de un socket conectado se rechazan al suspenderse", async () => {
    const client = connect({ token });
    expect(await connected(client)).toBe("connect");
    await suspend(userId);

    expect(await ack(client, "send_message", { chatId, content: "hola" })).toMatchObject({
      ok: false,
      code: "ACCOUNT_SUSPENDED",
    });
    expect(await ack(client, "join_chat", { chatId })).toMatchObject({ ok: false, code: "ACCOUNT_SUSPENDED" });
    await prisma.accountSanction.deleteMany({ where: { userId } });
  });

  test("el handshake de una cuenta suspendida se rechaza", async () => {
    const fresh = await createTestUser({ prefix: "susp-sock-hs" });
    reporterIds.push(fresh.user.id);
    await suspend(fresh.user.id);
    const stale = await prisma.user.findUniqueOrThrow({ where: { id: fresh.user.id } });

    const outcome = await connected(connect({ token: signAccessToken(stale) }));

    expect(outcome).toMatch(/suspendida/);
  });

  test("al crearse la sanción por umbral se desconecta el socket vivo", async () => {
    const target = await createTestUser({ prefix: "susp-sock-live" });
    reporterIds.push(target.user.id);
    const reporters = [];
    for (let i = 0; i < 5; i++) {
      const r = await createTestUser({ prefix: `susp-sock-rep${i}` });
      reporterIds.push(r.user.id);
      reporters.push(r.user.id);
    }
    jest.spyOn(sanctionClock, "now").mockReturnValue(new Date());
    const client = connect({ token: target.token });
    expect(await connected(client)).toBe("connect");
    const closed = new Promise<string>((resolve) => client.on("disconnect", resolve));

    for (const reporterId of reporters) {
      await accountReportsService.create(reporterId, { reportedUserId: target.user.id, severity: "mild" });
    }

    expect(await closed).toBe("io server disconnect");
  });
});
