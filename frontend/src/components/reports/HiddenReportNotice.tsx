import { REPORT_FLAG_REASON_LABELS } from '@/lib/report-flag-reasons'
import type { HiddenReasonDTO } from '@/types/report.types'

interface HiddenReportNoticeProps {
  hiddenReasons?: HiddenReasonDTO[]
}

// aviso al dueño: reporte oculto por denuncias y con qué motivos
export default function HiddenReportNotice({ hiddenReasons = [] }: HiddenReportNoticeProps) {
  return (
    <section aria-label='Reporte oculto por denuncias' className='rounded-control border border-danger/40 p-3 text-sm'>
      <p className='text-ink'>
        Este reporte está oculto por denuncias. No podés editarlo ni cerrarlo, pero sí eliminarlo.
      </p>
      {hiddenReasons.length > 0 && (
        <ul className='mt-2 list-disc pl-5 text-ink-muted'>
          {hiddenReasons.map(({ reason, count }) => (
            <li key={reason}>{`${REPORT_FLAG_REASON_LABELS[reason]}: ${count}`}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
