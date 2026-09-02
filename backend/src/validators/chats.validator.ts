import { z } from "zod";

export const createChatSchema = z.object({
  reportId: z.number().int().positive(),
  participantId: z.number().int().positive(),
});

export const chatIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const sendMessageBodySchema = z
  .object({
    content: z.string().min(1).optional(),
    imageUrl: z.string().url().optional(),
  })
  .refine((data) => Boolean(data.content) || Boolean(data.imageUrl), {
    message: "El mensaje necesita texto o una imagen",
  });

export type CreateChatInput = z.infer<typeof createChatSchema>;
export type SendMessageBodyInput = z.infer<typeof sendMessageBodySchema>;
