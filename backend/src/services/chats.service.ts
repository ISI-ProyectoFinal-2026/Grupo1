import { Chat, Message, Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function listByUser(userId: number): Promise<Chat[]> {
  return prisma.chat.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { createdAt: "desc" },
  });
}

export async function createChat(userId: number, participantId: number, reportId: number): Promise<Chat> {
  const existing = await prisma.chat.findFirst({
    where: {
      OR: [
        { userAId: userId, userBId: participantId },
        { userAId: participantId, userBId: userId },
      ],
    },
  });
  if (existing) {
    throw new AppError(409, "Ya existe un chat con este participante");
  }

  try {
    return await prisma.chat.create({ data: { userAId: userId, userBId: participantId, reportId } });
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      throw new AppError(409, "Ya existe un chat con este participante");
    }
    if (isPrismaKnownError(error, "P2003")) {
      throw new AppError(400, "reportId o participantId no corresponden a registros existentes");
    }
    throw error;
  }
}

export async function getMessages(chatId: number): Promise<Message[]> {
  return prisma.message.findMany({ where: { chatId }, orderBy: { createdAt: "asc" } });
}

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

export interface CreateMessageInput {
  content?: string;
  imageUrl?: string;
}

export async function createMessage(
  chatId: number,
  senderId: number,
  data: CreateMessageInput
): Promise<Message> {
  return prisma.message.create({
    data: { chatId, senderId, content: data.content ?? null, imageUrl: data.imageUrl ?? null },
  });
}
