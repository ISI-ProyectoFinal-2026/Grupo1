import { Chat, Message } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";

export async function assertParticipant(chatId: number, userId: number): Promise<Chat> {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) {
    throw new AppError(404, "Chat no encontrado");
  }
  if (chat.userAId !== userId && chat.userBId !== userId) {
    throw new AppError(403, "No pertenecés a este chat");
  }
  return chat;
}

export async function createMessage(chatId: number, senderId: number, content: string): Promise<Message> {
  return prisma.message.create({ data: { chatId, senderId, content } });
}
