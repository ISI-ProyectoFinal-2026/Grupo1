import { Prisma } from "@prisma/client";
import { activeSanctionWhere } from "./active";

// admins distintos del objetivo sin suspensión vigente
export function countOtherActiveAdmins(tx: Prisma.TransactionClient, targetId: number, now: Date): Promise<number> {
  return tx.user.count({
    where: { role: "admin", id: { not: targetId }, accountSanctions: { none: activeSanctionWhere(now) } },
  });
}
