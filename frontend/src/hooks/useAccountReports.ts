import { useMutation, useQuery } from '@tanstack/react-query'
import { createAccountReport, listReportedAccounts } from '@/services/moderation.service'
import { getApiErrorStatus } from '@/services/api'
import type { AccountReportSeverity } from '@/types/moderation.types'

export const reportedAccountsQueryKey = ['account-reports'] as const

export function useReportAccount(reportedUserId: number) {
  const mutation = useMutation({
    mutationFn: (severity: AccountReportSeverity) => createAccountReport(reportedUserId, severity),
  })

  // 409: ya la reportó o la cuenta tiene una sanción en curso; no hay reintento útil
  const conflict = mutation.isError && getApiErrorStatus(mutation.error) === 409
  const error = mutation.isError ? mutation.error.message : null

  return {
    report: (severity: AccountReportSeverity) => mutation.mutate(severity),
    isPending: mutation.isPending,
    isSent: mutation.isSuccess,
    isDone: mutation.isSuccess || conflict,
    error,
  }
}

export function useReportedAccountsQuery() {
  return useQuery({ queryKey: reportedAccountsQueryKey, queryFn: listReportedAccounts })
}
