import { z } from "zod";

export const joinChatSchema = z.object({
  chatId: z.number().int().positive(),
});

export const leaveChatSchema = z.object({
  chatId: z.number().int().positive(),
});

export const sendMessageSchema = z
  .object({
    chatId: z.number().int().positive(),
    content: z.string().min(1).optional(),
    imageUrl: z.string().url().optional(),
  })
  .refine((data) => Boolean(data.content) || Boolean(data.imageUrl), {
    message: "El mensaje necesita texto o una imagen",
  });

export type JoinChatInput = z.infer<typeof joinChatSchema>;
export type LeaveChatInput = z.infer<typeof leaveChatSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
