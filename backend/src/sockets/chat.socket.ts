import { Server as HttpServer } from "http";
import { Message } from "@prisma/client";
import { Server, Socket } from "socket.io";
import { AppError } from "../errors/app-error";
import * as chatsService from "../services/chats.service";
import * as notificationsService from "../services/notifications.service";
import { verifyAccessToken } from "../utils/jwt";
import { joinChatSchema, leaveChatSchema, sendMessageSchema } from "../validators/chat-socket.validator";

type AckResponse<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
type Ack<T = undefined> = (response: AckResponse<T>) => void;

interface ServerToClientEvents {
  receive_message: (message: Message) => void;
  error: (payload: { event: string; message: string }) => void;
}

interface ClientToServerEvents {
  join_chat: (payload: { chatId: number }, ack?: Ack) => void;
  leave_chat: (payload: { chatId: number }, ack?: Ack) => void;
  send_message: (payload: { chatId: number; content: string }, ack?: Ack<Message>) => void;
}

interface InterServerEvents {
  // Sin eventos server-to-server por ahora.
}

interface SocketData {
  userId: number;
}

export type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function chatRoom(chatId: number): string {
  return `chat:${chatId}`;
}

let chatIO: ChatServer | undefined;

export function getChatIO(): ChatServer | undefined {
  return chatIO;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return "Datos inválidos";
  }
  return "Error inesperado";
}

function extractToken(socket: ChatSocket): string | undefined {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.length > 0) {
    return authToken;
  }

  const header = socket.handshake.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }

  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === "string" && queryToken.length > 0) {
    return queryToken;
  }

  return undefined;
}

export function initChatSocket(httpServer: HttpServer): ChatServer {
  const io: ChatServer = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || "http://localhost:5173" },
  });
  chatIO = io;

  io.use((socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      next(new Error("Se requiere un token de autenticación"));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_chat", async (payload, ack) => {
      try {
        const { chatId } = joinChatSchema.parse(payload);
        await chatsService.assertParticipant(chatId, socket.data.userId);
        socket.join(chatRoom(chatId));
        ack?.({ ok: true, data: undefined });
      } catch (error) {
        const message = toErrorMessage(error);
        ack?.({ ok: false, error: message });
        socket.emit("error", { event: "join_chat", message });
      }
    });

    socket.on("leave_chat", (payload, ack) => {
      try {
        const { chatId } = leaveChatSchema.parse(payload);
        socket.leave(chatRoom(chatId));
        ack?.({ ok: true, data: undefined });
      } catch (error) {
        const message = toErrorMessage(error);
        ack?.({ ok: false, error: message });
        socket.emit("error", { event: "leave_chat", message });
      }
    });

    socket.on("send_message", async (payload, ack) => {
      try {
        const { chatId, content } = sendMessageSchema.parse(payload);
        const chat = await chatsService.assertParticipant(chatId, socket.data.userId);
        const message = await chatsService.createMessage(chatId, socket.data.userId, content);

        // Notificación best-effort: no debe tumbar el envío en tiempo real.
        try {
          await notificationsService.notifyNewMessage(chat, message);
        } catch (notifyError) {
          console.error(`[chat.socket] no se pudo notificar el mensaje del chat ${chatId}:`, notifyError);
        }

        io.to(chatRoom(chatId)).emit("receive_message", message);
        ack?.({ ok: true, data: message });
      } catch (error) {
        const message = toErrorMessage(error);
        ack?.({ ok: false, error: message });
        socket.emit("error", { event: "send_message", message });
      }
    });
  });

  return io;
}
