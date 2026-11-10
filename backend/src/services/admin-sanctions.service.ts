import {
  AccountReportSeverity,
  AccountSanction,
  AccountSanctionEventType,
  AccountSanctionKind,
  AccountSanctionStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { countOtherActiveAdmins } from "./account-sanctions/admins";
import { sanctionClock } from "./account-sanctions/clock";
import {
  applyAccountDeletionEffects,
  applyReinstatementEffects,
  applySanctionEffects,
} from "./account-sanctions/effects";
import { canDecide, countBySeverity, isRecidivism, planConfirmation } from "./account-sanctions/policy";

// caso de la cola: nunca incluye denunciantes ni ids de denuncias (id = id de la sanción)
export interface SanctionQueueItem {
  id: number;
  account: { id: number; fullName: string | null; email: string };
  role: Role;
  kind: AccountSanctionKind;
  status: AccountSanctionStatus;
  severity: AccountReportSeverity;
  recidivism: boolean;
  severityCounts: Record<AccountReportSeverity, number>;
  reportDates: Date[];
}

// casos por decidir: staff en revisión y suspensiones provisionales (eliminación por confirmar);
// cada actor ve solo los casos que puede decidir
export async function listPending(actorRole: Role): Promise<{ items: SanctionQueueItem[] }> {
  const sanctions = await prisma.accountSanction.findMany({
    where: { OR: [{ status: "pending_review" }, { status: "active", kind: "provisional" }] },
    include: {
      user: { select: { id: true, fullName: true, email: true, role: true } },
      reports: { select: { severity: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
  const items = sanctions
    .filter((s) => canDecide(actorRole, s, s.user.role))
    .map((s) => ({
    id: s.id,
    account: { id: s.user.id, fullName: s.user.fullName, email: s.user.email },
    role: s.user.role,
    kind: s.kind,
    status: s.status,
    severity: s.severity,
    recidivism: isRecidivism(s),
    severityCounts: countBySeverity(s.reports.map((r) => r.severity)),
    reportDates: s.reports.map((r) => r.createdAt),
  }));
  return { items };
}

export type SanctionDecisionResult =
  | (Pick<AccountSanction, "id" | "status" | "kind" | "endsAt"> & { accountDeleted: false })
  | { id: number; accountDeleted: true };

const decisionError = {
  notFound: () => new AppError(404, "Caso de sanción no encontrado"),
  decided: () => new AppError(409, "El caso ya fue decidido", undefined, "SANCTION_ALREADY_DECIDED"),
  self: () => new AppError(403, "No podés decidir sobre tu propia sanción", undefined, "SELF_SANCTION_DECISION"),
  forbidden: () => new AppError(403, "No tenés permiso para decidir este caso"),
  lastAdmin: () => new AppError(409, "No se puede sancionar al último administrador activo", undefined, "LAST_ADMIN"),
};

// caso decidible: staff en revisión o provisional vigente
const isDecidable = (s: Pick<AccountSanction, "status" | "kind">) =>
  s.status === "pending_review" || (s.status === "active" && s.kind === "provisional");

type Action = "confirm" | "revert";

type DecisionOutcome =
  | { type: "deleted"; userId: number; email: string }
  | { type: "updated"; updated: AccountSanction; wasPending: boolean };

async function decide(actorId: number, sanctionId: number, action: Action, reason: string): Promise<SanctionDecisionResult> {
  const outcome = await prisma.$transaction(async (tx): Promise<DecisionOutcome> => {
    // mismo lock que changeRole: serializa decisiones y chequeos de último admin
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('role_change'))`;
    const sanction = await tx.accountSanction.findUnique({
      where: { id: sanctionId },
      include: { user: { select: { role: true, email: true } } },
    });
    if (!sanction) throw decisionError.notFound();
    if (sanction.userId === actorId) throw decisionError.self();
    const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
    if (!actor || !canDecide(actor.role, sanction, sanction.user.role)) throw decisionError.forbidden();
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${sanction.userId} FOR UPDATE`;
    if (!isDecidable(sanction)) throw decisionError.decided();

    const now = sanctionClock.now();
    const wasPending = sanction.status === "pending_review";
    let data: Prisma.AccountSanctionUpdateManyMutationInput;
    let eventType: AccountSanctionEventType;
    if (action === "confirm") {
      if (wasPending && sanction.user.role === "admin" && (await countOtherActiveAdmins(tx, sanction.userId, now)) === 0) {
        throw decisionError.lastAdmin();
      }
      const plan = planConfirmation(sanction, now);
      if (plan.action === "delete_account") {
        // baja definitiva: la cascada borra la sanción, su historial y todos los datos de la cuenta
        await tx.user.delete({ where: { id: sanction.userId } });
        console.info(`[sanciones] cuenta ${sanction.userId} eliminada por el usuario ${actorId} (caso ${sanctionId})`);
        return { type: "deleted", userId: sanction.userId, email: sanction.user.email };
      }
      data = { ...plan.decision, ...(wasPending ? { startsAt: now } : {}) };
      eventType = "confirmed";
    } else {
      data = { status: wasPending ? "dismissed" : "reverted" };
      eventType = wasPending ? "dismissed" : "reverted";
    }

    // solo prospera si el caso sigue como lo leímos
    const { count } = await tx.accountSanction.updateMany({
      where: { id: sanctionId, status: sanction.status, kind: sanction.kind },
      data,
    });
    if (count === 0) throw decisionError.decided();
    await tx.accountSanctionEvent.create({ data: { sanctionId, actorId, type: eventType, reason } });
    if (action === "confirm" && wasPending) {
      await tx.user.update({ where: { id: sanction.userId }, data: { tokenVersion: { increment: 1 } } });
    }
    return {
      type: "updated",
      updated: await tx.accountSanction.findUniqueOrThrow({ where: { id: sanctionId } }),
      wasPending,
    };
  });

  if (outcome.type === "deleted") {
    await applyAccountDeletionEffects(outcome);
    return { id: sanctionId, accountDeleted: true };
  }
  const { updated, wasPending } = outcome;
  if (action === "confirm") await applySanctionEffects(updated);
  else if (!wasPending) await applyReinstatementEffects(updated);
  return { id: updated.id, status: updated.status, kind: updated.kind, endsAt: updated.endsAt, accountDeleted: false };
}

export const confirm = (actorId: number, sanctionId: number, reason: string) =>
  decide(actorId, sanctionId, "confirm", reason);

export const revert = (actorId: number, sanctionId: number, reason: string) =>
  decide(actorId, sanctionId, "revert", reason);
