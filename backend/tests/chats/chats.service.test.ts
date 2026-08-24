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
      const message = await chatsService.createMessage(chatId, userAId, "hola!");

      expect(message.id).toBeDefined();
      expect(message.chatId).toBe(chatId);
      expect(message.senderId).toBe(userAId);
      expect(message.content).toBe("hola!");

      const stored = await prisma.message.findUnique({ where: { id: message.id } });
      expect(stored).not.toBeNull();
    });
  });
});
