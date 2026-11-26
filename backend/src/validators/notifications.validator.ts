import { z } from "zod";
import { cursorPageQuerySchema } from "./pagination.validator";

export const listNotificationsQuerySchema = cursorPageQuerySchema(20);

export const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
