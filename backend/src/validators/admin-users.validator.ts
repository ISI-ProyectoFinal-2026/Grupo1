import { z } from "zod";
import { Role } from "@prisma/client";

export const adminUserIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const changeUserRoleSchema = z.object({
  role: z.enum([Role.usuario_regular, Role.moderador, Role.admin]),
});

const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
};

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum([Role.usuario_regular, Role.moderador, Role.admin]).optional(),
  ...paginationShape,
});

// auditoría: solo paginación, sin filtros
export const listRoleAuditQuerySchema = z.object(paginationShape);

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ListRoleAuditQuery = z.infer<typeof listRoleAuditQuerySchema>;
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
