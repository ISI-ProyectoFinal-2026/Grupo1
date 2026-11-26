import { z } from "zod";
import { decodeCursor } from "../utils/keyset-cursor";

export const MAX_PAGE_LIMIT = 50;

const cursorSchema = z
  .string()
  .max(64)
  .transform((value, ctx) => {
    const cursor = decodeCursor(value);
    if (!cursor) {
      ctx.addIssue({ code: "custom", message: "Cursor inválido" });
      return z.NEVER;
    }
    return cursor;
  });

// limit + cursor keyset (#338)
export function cursorPageQuerySchema(defaultLimit: number) {
  return z.object({
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(defaultLimit),
    cursor: cursorSchema.optional(),
  });
}

export type CursorPageQuery = z.infer<ReturnType<typeof cursorPageQuerySchema>>;
