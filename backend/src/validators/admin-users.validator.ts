import { z } from "zod";
import { Role } from "@prisma/client";

export const adminUserIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const changeUserRoleSchema = z.object({
  role: z.enum([Role.usuario_regular, Role.moderador, Role.admin]),
});

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
