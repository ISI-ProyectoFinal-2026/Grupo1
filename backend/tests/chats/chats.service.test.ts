import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as chatsService from "../../src/services/chats.service";

describe("chats.service", () => {
  let userAId: number;
  let userBId: number;
  let outsiderId: number;
  let chatId: number;

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: { email: `chats-service-test-a-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: { email: `chats-service-test-b-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userBId = userB.id;

    const outsider = await prisma.user.create({
      data: { email: `chats-service-test-outsider-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    outsiderId = outsider.id;

    const chat = await prisma.chat.create({ data: { userAId, userBId } });
    chatId = chat.id;
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { chatId } });
    await prisma.chat.delete({ where: { id: chatId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.user.delete({ where: { id: userBId } });
    await prisma.user.delete({ where: { id: outsiderId } });
    await prisma.$disconnect();
  });

  describe("assertParticipant()", () => {
    test("devuelve el chat cuando el usuario es userA", async () => {
      const chat = await chatsService.assertParticipant(chatId, userAId);
      expect(chat.id).toBe(chatId);
    });

    test("devuelve el chat cuando el usuario es userB", async () => {
      const chat = await chatsService.assertParticipant(chatId, userBId);
      expect(chat.id).toBe(chatId);
    });

    test("lanza AppError 403 si el usuario no participa del chat", async () => {
      await expect(chatsService.assertParticipant(chatId, outsiderId)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    test("lanza AppError 404 si el chat no existe", async () => {
      await expect(chatsService.assertParticipant(999999999, userAId)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("createMessage()", () => {
    test("persiste el mensaje asociado al chat y al remitente", async () => {
      const message = await chatsService.createMessage(chatId, userAId, { content: "hola!" });

      expect(message.id).toBeDefined();
      expect(message.chatId).toBe(chatId);
      expect(message.senderId).toBe(userAId);
      expect(message.content).toBe("hola!");
      expect(message.imageUrl).toBeNull();

      const stored = await prisma.message.findUnique({ where: { id: message.id } });
      expect(stored).not.toBeNull();
    });

    test("persiste un mensaje de solo imagen, sin texto", async () => {
      const message = await chatsService.createMessage(chatId, userAId, {
        imageUrl: "https://pub-test.r2.dev/chat/foto.jpg",
      });

      expect(message.content).toBeNull();
      expect(message.imageUrl).toBe("https://pub-test.r2.dev/chat/foto.jpg");
    });

    test("persiste un mensaje con texto e imagen a la vez", async () => {
      const message = await chatsService.createMessage(chatId, userAId, {
        content: "mirá esto",
        imageUrl: "https://pub-test.r2.dev/chat/foto2.jpg",
      });

      expect(message.content).toBe("mirá esto");
      expect(message.imageUrl).toBe("https://pub-test.r2.dev/chat/foto2.jpg");
    });
  });

  describe("getMessages()", () => {
    test("devuelve los mensajes del chat ordenados por fecha de creación", async () => {
      const first = await chatsService.createMessage(chatId, userAId, { content: "primero" });
      const second = await chatsService.createMessage(chatId, userBId, { content: "segundo" });

      const messages = await chatsService.getMessages(chatId);
      const firstIndex = messages.findIndex((m) => m.id === first.id);
      const secondIndex = messages.findIndex((m) => m.id === second.id);

      expect(firstIndex).toBeGreaterThanOrEqual(0);
      expect(secondIndex).toBeGreaterThan(firstIndex);
    });
  });

  describe("listByUser()", () => {
    test("devuelve los chats donde el usuario participa como userA o userB", async () => {
      const chatsForA = await chatsService.listByUser(userAId);
      expect(chatsForA.some((c) => c.id === chatId)).toBe(true);

      const chatsForB = await chatsService.listByUser(userBId);
      expect(chatsForB.some((c) => c.id === chatId)).toBe(true);
    });

    test("no devuelve chats de otros usuarios", async () => {
      const chatsForOutsider = await chatsService.listByUser(outsiderId);
      expect(chatsForOutsider.some((c) => c.id === chatId)).toBe(false);
    });
  });

  describe("createChat()", () => {
    // userA es el autor de ambos reportes; outsider es quien lo contacta.
    let reportId: number;
    let otherReportId: number;
    const createdChatIds: number[] = [];

    const trackChat = (id: number) => {
      if (!createdChatIds.includes(id)) createdChatIds.push(id);
    };

    beforeAll(async () => {
      const report = await prisma.report.create({
        data: { userId: userAId, reportType: "lost", title: "Perro perdido" },
      });
      reportId = report.id;

      const otherReport = await prisma.report.create({
        data: { userId: userAId, reportType: "found", title: "Gato encontrado" },
      });
      otherReportId = otherReport.id;
    });

    afterEach(async () => {
      while (createdChatIds.length > 0) {
        const id = createdChatIds.pop()!;
        await prisma.chat.deleteMany({ where: { id } });
      }
    });

    afterAll(async () => {
      await prisma.report.deleteMany({ where: { id: { in: [reportId, otherReportId] } } });
    });

    test("crea el chat vinculado al reporte, con el par de usuarios normalizado (userAId < userBId)", async () => {
      const { chat, created } = await chatsService.createChat(outsiderId, userAId, reportId);
      trackChat(chat.id);

      expect(created).toBe(true);
      expect(chat.userAId).toBe(Math.min(outsiderId, userAId));
      expect(chat.userBId).toBe(Math.max(outsiderId, userAId));
      expect(chat.reportId).toBe(reportId);
    });

    test("si ya existe el chat de ese reporte entre los mismos usuarios, lo devuelve sin crear otro", async () => {
      const first = await chatsService.createChat(outsiderId, userAId, reportId);
      trackChat(first.chat.id);

      const second = await chatsService.createChat(outsiderId, userAId, reportId);

      expect(second.created).toBe(false);
      expect(second.chat.id).toBe(first.chat.id);
      expect(await prisma.chat.count({ where: { reportId } })).toBe(1);
    });

    test("el mismo par de usuarios tiene un chat distinto por cada reporte", async () => {
      const first = await chatsService.createChat(outsiderId, userAId, reportId);
      trackChat(first.chat.id);
      const second = await chatsService.createChat(outsiderId, userAId, otherReportId);
      trackChat(second.chat.id);

      expect(second.created).toBe(true);
      expect(second.chat.id).not.toBe(first.chat.id);
      expect(first.chat.reportId).toBe(reportId);
      expect(second.chat.reportId).toBe(otherReportId);
    });

    test("creaciones concurrentes para el mismo reporte terminan en un único chat", async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () => chatsService.createChat(outsiderId, userAId, reportId))
      );
      results.forEach(({ chat }) => trackChat(chat.id));

      const ids = new Set(results.map(({ chat }) => chat.id));
      expect(ids.size).toBe(1);
      expect(results.filter(({ created }) => created)).toHaveLength(1);
      expect(await prisma.chat.count({ where: { reportId } })).toBe(1);
    });

    test("lanza AppError 400 si el usuario intenta abrir un chat consigo mismo", async () => {
      await expect(chatsService.createChat(userAId, userAId, reportId)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(await prisma.chat.count({ where: { reportId } })).toBe(0);
    });

    test("lanza AppError 403 si participantId no es el autor del reporte", async () => {
      await expect(chatsService.createChat(outsiderId, userBId, reportId)).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(await prisma.chat.count({ where: { reportId } })).toBe(0);
    });

    test("lanza AppError 403 si el autor intenta abrir un chat de su reporte con otro usuario", async () => {
      await expect(chatsService.createChat(userAId, outsiderId, reportId)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    test("lanza AppError 403 si participantId no corresponde a un usuario existente", async () => {
      await expect(chatsService.createChat(outsiderId, 999999999, reportId)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    test("lanza AppError 404 si el reporte no existe", async () => {
      await expect(chatsService.createChat(outsiderId, userAId, 999999999)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
