import { Prisma, Role } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import type { ListRoleAuditQuery, ListUsersQuery } from "../validators/admin-users.validator";

// usuario sin passwordHash ni secretos
const adminUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type AdminUser = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listUsers({ q, role, page, pageSize }: ListUsersQuery): Promise<Paginated<AdminUser>> {
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: adminUserSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

const auditUserSelect = { id: true, email: true, fullName: true } satisfies Prisma.UserSelect;

const roleAuditSelect = {
  id: true,
  createdAt: true,
  previousRole: true,
  newRole: true,
  actor: { select: auditUserSelect },
  target: { select: auditUserSelect },
} satisfies Prisma.RoleChangeAuditSelect;

export type RoleAuditEntry = Prisma.RoleChangeAuditGetPayload<{ select: typeof roleAuditSelect }>;

export async function listRoleAudit({ page, pageSize }: ListRoleAuditQuery): Promise<Paginated<RoleAuditEntry>> {
  const [items, total] = await Promise.all([
    prisma.roleChangeAudit.findMany({
      select: roleAuditSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.roleChangeAudit.count(),
  ]);
  return { items, total, page, pageSize };
}

export function assertAdminRemains(adminCount: number, previousRole: Role, newRole: Role): void {
  if (previousRole === "admin" && newRole !== "admin" && adminCount <= 1) {
    throw new AppError(409, "No se puede quitar el último administrador", undefined, "LAST_ADMIN");
  }
}

export async function changeRole(actorId: number, targetId: number, newRole: Role): Promise<AdminUser> {
  return prisma.$transaction(async (tx) => {
    // serializa todos los cambios de rol; se libera al cerrar la transacción
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('role_change'))`;

    const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
    if (!actor || actor.role !== "admin") {
      throw new AppError(403, "No tenés permiso para acceder a este recurso");
    }
    if (actorId === targetId) {
      throw new AppError(400, "No podés cambiar tu propio rol", undefined, "SELF_ROLE_CHANGE");
    }

    const target = await tx.user.findUnique({ where: { id: targetId }, select: { role: true } });
    if (!target) {
      throw new AppError(404, "Usuario no encontrado");
    }
    if (target.role === newRole) {
      throw new AppError(400, "El usuario ya tiene ese rol", undefined, "ROLE_UNCHANGED");
    }

    const adminCount = await tx.user.count({ where: { role: "admin" } });
    assertAdminRemains(adminCount, target.role, newRole);

    const updated = await tx.user.update({ where: { id: targetId }, data: { role: newRole }, select: adminUserSelect });
    await tx.roleChangeAudit.create({
      data: { actorId, targetId, previousRole: target.role, newRole },
    });
    // obligatoria: no consulta las preferencias de notificación
    await tx.notification.create({
      data: {
        userId: targetId,
        type: "role_change",
        title: "Tu rol cambió",
        message: `Un administrador cambió tu rol a ${newRole}.`,
      },
    });

    return updated;
  });
}
