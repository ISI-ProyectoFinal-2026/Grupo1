import { AccountReportSeverity } from "@prisma/client";

// punto de entrada de la sanción por gravedad: la aplica #38
export async function onAccountReportThreshold(userId: number, severity: AccountReportSeverity): Promise<void> {
  console.info(`[account-sanctions] la cuenta ${userId} llegó al umbral de denuncias con gravedad ${severity}`);
}
