import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { activeAuthorSql, activeSanctionWhere } from "./active";
import { sanctionClock } from "./clock";

// autor sin suspensión vigente, para SQL crudo
export const visibleAuthorSql = (userIdColumn: Prisma.Sql): Prisma.Sql =>
  activeAuthorSql(userIdColumn, sanctionClock.now());

// autor sin suspensión vigente, para consultas Prisma sobre user
export const visibleUserWhere = (): Prisma.UserWhereInput => ({
  accountSanctions: { none: activeSanctionWhere(sanctionClock.now()) },
});

export async function isAuthorSuspended(userId: number): Promise<boolean> {
  const count = await prisma.accountSanction.count({
    where: { userId, ...activeSanctionWhere(sanctionClock.now()) },
  });
  return count > 0;
}
