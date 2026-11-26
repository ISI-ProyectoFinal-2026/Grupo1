import { Link, useNavigate } from 'react-router-dom'
import { buttonClasses } from '@/components/ui/buttonClasses'
import InactivityWarningBanner from '@/components/reports/InactivityWarningBanner'
import CloseReportButton from '@/components/reports/CloseReportButton'
import DeleteReportButton from '@/components/reports/DeleteReportButton'
import type { useCloseReport } from '@/hooks/useCloseReport'
import { useDeleteReport } from '@/hooks/useDeleteReport'
import type { ReportDTO } from '@/types/report.types'

interface ReportOwnerActionsProps {
  report: Pick<ReportDTO, 'id' | 'userId' | 'status'>
  reportId: number
  canClose: boolean
  closeReport: ReturnType<typeof useCloseReport>
}

// acciones del dueño: aviso de inactividad, cerrar, editar y eliminar
export default function ReportOwnerActions({
  report,
  reportId,
  canClose,
  closeReport,
}: ReportOwnerActionsProps) {
  const navigate = useNavigate()
  const deleteReport = useDeleteReport(reportId, () =>
    navigate('/reports', { replace: true, state: { message: 'Reporte eliminado' } })
  )
  // oculto por denuncias: el dueño no edita ni cierra, solo elimina
  const isHidden = report.status === 'hidden'

  return (
    <>
      <InactivityWarningBanner report={report} />

      {canClose && (
        <CloseReportButton
          onConfirm={closeReport.close}
          isPending={closeReport.isPending}
          error={closeReport.error}
        />
      )}

      <div className='grid grid-cols-1 gap-2'>
        {!isHidden && (
          <Link
            to={`/reports/${report.id}/edit`}
            className={buttonClasses('secondary', 'md', 'w-full')}
          >
            Editar reporte
          </Link>
        )}
        <DeleteReportButton
          onConfirm={deleteReport.remove}
          isPending={deleteReport.isPending}
          error={deleteReport.error}
        />
      </div>
    </>
  )
}
