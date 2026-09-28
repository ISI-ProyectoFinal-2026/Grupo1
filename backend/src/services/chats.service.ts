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

export interface CreateChatResult {
  chat: Chat;
  // false si el chat ya existía: el controller responde 200 en vez de 201
  created: boolean;
}

/**
 * Abre (o recupera) el chat de un reporte entre el usuario y el autor del
 * reporte. El chat es POR REPORTE y la operación es idempotente: si ya existe
 * el chat de ese reporte entre ambos, se devuelve ese mismo chat (200) en vez
 * de un 409. Así el frontend no necesita fallback y no hay forma de terminar
 * en el chat de otro reporte.
 *
 * El par se guarda normalizado (userAId = id menor, userBId = id mayor), así
 * que el unique [userAId, userBId, reportId] cubre ambos sentidos. La creación
 * es atómica: si dos requests llegan a la vez, una crea y la otra recibe P2002
 * y devuelve el chat que ganó la carrera.
 */
export async function createChat(
  userId: number,
  participantId: number,
  reportId: number
): Promise<CreateChatResult> {
  if (participantId === userId) {
    throw new AppError(400, "No podés abrir un chat con vos mismo");
  }

  const report = await prisma.report.findUnique({ where: { id: reportId }, select: { userId: true } });
  if (!report) {
    throw new AppError(404, "Reporte no encontrado");
  }
  // Sólo se puede contactar al autor del reporte. Evita enumerar usuarios y
  // abrir chats con cuentas sin relación con el reporte (#169).
  if (report.userId !== participantId) {
    throw new AppError(403, "Sólo podés abrir un chat con el autor del reporte");
  }

  const key = {
    userAId: Math.min(userId, participantId),
    userBId: Math.max(userId, participantId),
    reportId,
  };

  const existing = await prisma.chat.findUnique({ where: { userAId_userBId_reportId: key } });
  if (existing) {
    return { chat: existing, created: false };
  }

  try {
    return { chat: await prisma.chat.create({ data: key }), created: true };
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      // Otra request creó el mismo chat entre el findUnique y el create.
      const winner = await prisma.chat.findUnique({ where: { userAId_userBId_reportId: key } });
      if (winner) {
        return { chat: winner, created: false };
      }
      // El unique chocó pero el chat ganador ya no está (ej. se borró en el
      // medio): es un conflicto transitorio, no un error del server.
      throw new AppError(409, "El chat se está creando o cambió recién, intentá de nuevo");
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
