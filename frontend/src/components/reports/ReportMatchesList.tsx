import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { PawIcon } from '@/components/ui/icons'
import MatchCard from '@/components/reports/MatchCard'
import CloseReportButton from '@/components/reports/CloseReportButton'
import { useMatchActions } from '@/hooks/useMatchActions'
import type { useCloseReport } from '@/hooks/useCloseReport'
import type { MatchDTO } from '@/types/report.types'

interface ReportMatchesListProps {
  reportId: number
  matches?: MatchDTO[]
  isLoading: boolean
  canManage: boolean
  offerClose: boolean
  closeReport: ReturnType<typeof useCloseReport>
}

// coincidencias sugeridas del reporte, con la oferta de cierre tras confirmar (#221)
export default function ReportMatchesList({
  reportId,
  matches,
  isLoading,
  canManage,
  offerClose,
  closeReport,
}: ReportMatchesListProps) {
  const matchActions = useMatchActions(reportId)

  return (
    <>
      <h2 id='coincidencias' className='font-display text-display-sm text-ink'>
        Coincidencias sugeridas
      </h2>
      {offerClose && (
        <div className='card mt-3 flex flex-col gap-3 border-signal p-4'>
          <p className='text-ink'>
            Confirmaste una coincidencia. Si ya resolviste el caso, podés cerrar tu reporte.
          </p>
          <CloseReportButton
            label='Cerrar mi reporte'
            onConfirm={closeReport.close}
            isPending={closeReport.isPending}
            error={closeReport.error}
          />
        </div>
      )}
      <div className='mt-3'>
        {isLoading ? (
          <SkeletonGroup className='grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1'>
            {[0, 1].map((key) => (
              <div key={key} className='card flex gap-3 p-3'>
                <Skeleton className='h-[88px] w-[88px] shrink-0 rounded-[10px]' />
                <div className='flex flex-1 flex-col gap-2 py-1'>
                  <Skeleton className='h-4 w-3/4' />
                  <Skeleton className='h-5 w-20 rounded-full' />
                  <Skeleton className='mt-auto h-3.5 w-1/2' />
                </div>
              </div>
            ))}
          </SkeletonGroup>
        ) : matches && matches.length > 0 ? (
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1'>
            {matches.map((match, index) => (
              <div
                key={match.matchId}
                className='animate-rise'
                style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
              >
                <MatchCard
                  match={match}
                  canManage={canManage}
                  onConfirm={matchActions.confirm}
                  onReject={matchActions.reject}
                  isBusy={matchActions.isBusy}
                  error={matchActions.errorFor(match.matchId)}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className='flex animate-fade items-center gap-3 rounded-card border border-dashed border-line bg-paper/60 p-4 text-sm text-ink-muted'>
            <PawIcon className='h-5 w-5 shrink-0' strokeWidth={1.75} />
            No se encontraron coincidencias todavía
          </p>
        )}
      </div>
    </>
  )
}
