import { Link } from 'react-router-dom'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { BoneTag } from '@/components/ui/canine'
import DeleteReportButton from '@/components/reports/DeleteReportButton'
import HiddenReportNotice from '@/components/reports/HiddenReportNotice'
import ReportTypeBadge from '@/components/reports/ReportTypeBadge'
import { useDeleteReport } from '@/hooks/useDeleteReport'
import { REPORT_STATUS_LABELS } from '@/lib/report-status'
import type { ReportDTO } from '@/types/report.types'

interface MyReportCardProps {
  report: ReportDTO
}

// la lista se refresca sola: useDeleteReport invalida ['reports']
export default function MyReportCard({ report }: MyReportCardProps) {
  const deleteReport = useDeleteReport(report.id, () => {})
  // oculto por denuncias: el dueño solo puede verlo o eliminarlo
  const isHidden = report.status === 'hidden'

  return (
    <li className='card flex flex-col gap-3 p-4'>
      <div className='flex items-center gap-4'>
        {report.imageUrl ? (
          <img
            src={report.imageUrl}
            alt=''
            className='size-20 shrink-0 rounded-control border border-line object-cover'
          />
        ) : (
          <span className='grid size-20 shrink-0 place-items-center rounded-control bg-surface'>
            <BoneTag className='w-14 -rotate-6' />
          </span>
        )}
        <div className='flex min-w-0 flex-col gap-1.5'>
          <h2 className='truncate font-display text-display-sm'>{report.title}</h2>
          <div className='flex flex-wrap items-center gap-2'>
            <ReportTypeBadge reportType={report.reportType} />
            <span className='text-sm text-ink-muted'>
              Estado: <span className='font-bold text-ink'>{REPORT_STATUS_LABELS[report.status]}</span>
            </span>
          </div>
        </div>
      </div>

      {isHidden && <HiddenReportNotice hiddenReasons={report.hiddenReasons} />}

      <div className={isHidden ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 gap-2'}>
        <Link
          to={`/reports/${report.id}`}
          aria-label={`Ver ${report.title}`}
          className={buttonClasses('secondary')}
        >
          Ver
        </Link>
        {!isHidden && (
          <Link
            to={`/reports/${report.id}/edit`}
            aria-label={`Editar ${report.title}`}
            className={buttonClasses('secondary')}
          >
            Editar
          </Link>
        )}
      </div>
      <DeleteReportButton
        onConfirm={deleteReport.remove}
        isPending={deleteReport.isPending}
        error={deleteReport.error}
      />
    </li>
  )
}
