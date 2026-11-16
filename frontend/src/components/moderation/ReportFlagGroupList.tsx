import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { REPORT_FLAG_REASONS, REPORT_FLAG_REASON_LABELS } from '@/lib/report-flag-reasons'
import { REPORT_STATUS_LABELS } from '@/lib/report-status'
import type { ModerationAction, ReportFlagGroupDTO } from '@/types/moderation.types'
import type { ReportStatus } from '@/types/report.types'

const REPORT_STATUS_COLORS: Record<ReportStatus, string> = {
  pending: '#8A5A0B',
  published: '#1F7A4D',
  rejected: '#C4342B',
  hidden: '#C4342B',
  resolved: '#2457A6',
}

interface ReportFlagGroupListProps {
  groups: ReportFlagGroupDTO[]
  onAction: (reportId: number, action: ModerationAction) => void
  // una acción bloquea el resto: evita resolver dos veces el mismo reporte
  isActing: boolean
}

interface ActionButtonProps {
  label: string
  variant: 'secondary' | 'danger'
  disabled: boolean
  onClick: () => void
}

function ActionButton({ label, variant, disabled, onClick }: ActionButtonProps) {
  return (
    <button type='button' onClick={onClick} disabled={disabled} className={buttonClasses(variant, 'sm')}>
      {label}
    </button>
  )
}

function GroupCard({ group, onAction, isActing }: { group: ReportFlagGroupDTO } & Omit<ReportFlagGroupListProps, 'groups'>) {
  const { report } = group
  const isHidden = report.status === 'hidden'

  return (
    <li className='card flex flex-col gap-2 p-4'>
      <div className='flex items-start justify-between gap-3'>
        <Link
          to={`/reports/${report.id}`}
          className='min-w-0 break-words font-display text-display-sm text-ink underline-offset-4 hover:underline'
        >
          {report.title}
        </Link>
        <Badge
          label={REPORT_STATUS_LABELS[report.status]}
          color={REPORT_STATUS_COLORS[report.status]}
          className='shrink-0'
        />
      </div>

      {report.description && <p className='break-words text-sm text-ink-muted'>{report.description}</p>}

      <p className='text-sm font-bold text-ink'>
        {group.flagCount} {group.flagCount === 1 ? 'denuncia' : 'denuncias'}
      </p>
      <ul className='flex flex-wrap gap-2 text-sm text-ink'>
        {REPORT_FLAG_REASONS.filter((reason) => group.reasonCounts[reason]).map((reason) => (
          <li key={reason} className='rounded-card border border-line px-2 py-0.5'>
            {REPORT_FLAG_REASON_LABELS[reason]}: {group.reasonCounts[reason]}
          </li>
        ))}
      </ul>
      {group.otherDetails.length > 0 && (
        <ul className='flex flex-col gap-1'>
          {group.otherDetails.map((detail, index) => (
            <li key={index} className='break-words border-l-4 border-line pl-3 text-ink'>
              {detail}
            </li>
          ))}
        </ul>
      )}

      <div className='flex flex-wrap items-center justify-end gap-2'>
        {isHidden ? (
          <>
            <ActionButton label='Restaurar' variant='secondary' disabled={isActing} onClick={() => onAction(report.id, 'restore')} />
            <ActionButton label='Confirmar ocultamiento' variant='danger' disabled={isActing} onClick={() => onAction(report.id, 'confirm')} />
          </>
        ) : (
          <>
            <ActionButton label='Descartar' variant='secondary' disabled={isActing} onClick={() => onAction(report.id, 'dismiss')} />
            <ActionButton label='Ocultar' variant='danger' disabled={isActing} onClick={() => onAction(report.id, 'hide')} />
          </>
        )}
      </div>
    </li>
  )
}

function Section({ id, title, note, groups, onAction, isActing }: ReportFlagGroupListProps & { id: string; title: string; note?: string }) {
  if (groups.length === 0) return null
  return (
    <section aria-labelledby={id} className='flex flex-col gap-3'>
      <h2 id={id} className='font-display text-display-md'>
        {title}
      </h2>
      {note && <p className='max-w-prose text-sm text-ink-muted'>{note}</p>}
      <ul className='flex flex-col gap-3'>
        {groups.map((group) => (
          <GroupCard key={group.report.id} group={group} onAction={onAction} isActing={isActing} />
        ))}
      </ul>
    </section>
  )
}

function ReportFlagGroupList({ groups, onAction, isActing }: ReportFlagGroupListProps) {
  if (groups.length === 0) {
    return (
      <EmptyState>
        <p className='text-ink-muted'>No hay reportes pendientes de moderación</p>
      </EmptyState>
    )
  }

  const hidden = groups.filter((group) => group.report.status === 'hidden')
  const published = groups.filter((group) => group.report.status !== 'hidden')

  return (
    <div className='flex flex-col gap-6'>
      <Section
        id='flag-group-hidden'
        title='Ocultos pendientes de revisión'
        note='Restaurar vuelve a publicar el reporte. Confirmar es definitivo: el reporte queda oculto y no se puede restaurar.'
        groups={hidden}
        onAction={onAction}
        isActing={isActing}
      />
      <Section
        id='flag-group-published'
        title='Publicados con denuncias'
        groups={published}
        onAction={onAction}
        isActing={isActing}
      />
    </div>
  )
}

export default ReportFlagGroupList
