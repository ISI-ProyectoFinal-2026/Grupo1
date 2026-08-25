import { z } from "zod";

export const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
