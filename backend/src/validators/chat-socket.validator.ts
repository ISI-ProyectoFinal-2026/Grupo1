import { z } from "zod";

export const joinChatSchema = z.object({
  chatId: z.number().int().positive(),
});

export const leaveChatSchema = z.object({
  chatId: z.number().int().positive(),
});

export const sendMessageSchema = z.object({
  chatId: z.number().int().positive(),
  content: z.string().min(1),
});

export type JoinChatInput = z.infer<typeof joinChatSchema>;
export type LeaveChatInput = z.infer<typeof leaveChatSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
