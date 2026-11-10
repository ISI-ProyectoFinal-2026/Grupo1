import { formatLongDate } from '@/lib/format'
import type { SuspensionDetails, SuspensionType } from '@/types/auth'

const TYPE_LABELS: Record<SuspensionType, string> = {
  temporary: 'Suspensión temporal',
  provisional: 'Suspensión provisional',
}

interface SuspensionNoticeProps {
  // texto fijo por gravedad que manda el backend
  message: string
  suspension: SuspensionDetails
}

function SuspensionNotice({ message, suspension }: SuspensionNoticeProps) {
  return (
    <div
      role='alert'
      className='mt-4 flex flex-col gap-1 rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger'
    >
      <p className='font-bold'>{message}</p>
      <p>{TYPE_LABELS[suspension.type]}</p>
      {suspension.endsAt && <p>Hasta el {formatLongDate(suspension.endsAt)}.</p>}
      {suspension.type === 'provisional' && (
        <p>
          La suspensión es preventiva hasta que el equipo de moderación revise el caso; si se
          confirma, la cuenta se elimina de forma definitiva.
        </p>
      )}
      {suspension.warning && (
        <p className='font-bold'>
          Si volvés a recibir denuncias, tu cuenta puede ser eliminada de forma definitiva.
        </p>
      )}
    </div>
  )
}

export default SuspensionNotice
