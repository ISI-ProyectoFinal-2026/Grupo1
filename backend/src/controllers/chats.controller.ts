import { Request, Response } from "express";
import * as chatsService from "../services/chats.service";
import * as notificationsService from "../services/notifications.service";
import { chatRoom, getChatIO } from "../sockets/chat.socket";
import { chatIdParamSchema, createChatSchema, sendMessageBodySchema } from "../validators/chats.validator";

export async function list(req: Request, res: Response): Promise<void> {
  const chats = await chatsService.listByUser(req.userId!);
  res.status(200).json(chats);
}

export async function create(req: Request, res: Response): Promise<void> {
  const { reportId, participantId } = createChatSchema.parse(req.body);
  const chat = await chatsService.createChat(req.userId!, participantId, reportId);
  res.status(201).json(chat);
}

export async function getMessages(req: Request, res: Response): Promise<void> {
  const { id } = chatIdParamSchema.parse(req.params);
  await chatsService.assertParticipant(id, req.userId!);
  const messages = await chatsService.getMessages(id);
  res.status(200).json(messages);
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { id } = chatIdParamSchema.parse(req.params);
  const { content, imageUrl } = sendMessageBodySchema.parse(req.body);
  const chat = await chatsService.assertParticipant(id, req.userId!);
  const message = await chatsService.createMessage(id, req.userId!, { content, imageUrl });

  // La notificación es secundaria al envío: si falla, el mensaje igual se
  // persiste y se emite. No queremos que un error de notificación devuelva 500.
  try {
    await notificationsService.notifyNewMessage(chat, message);
  } catch (error) {
    console.error(`[chats] no se pudo notificar el mensaje del chat ${id}:`, error);
  }

  getChatIO()?.to(chatRoom(id)).emit("receive_message", message);
  res.status(201).json(message);
}
