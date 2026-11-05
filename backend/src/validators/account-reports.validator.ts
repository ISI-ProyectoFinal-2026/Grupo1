import { z } from "zod";
import { AccountReportSeverity } from "@prisma/client";

export const createAccountReportSchema = z.object({
  reportedUserId: z.number().int().positive(),
  severity: z.nativeEnum(AccountReportSeverity),
});

export type CreateAccountReportInput = z.infer<typeof createAccountReportSchema>;
