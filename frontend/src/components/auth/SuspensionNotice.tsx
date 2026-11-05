import { formatLongDate } from '@/lib/format'
import type { SuspensionDetails, SuspensionType } from '@/types/auth'

const TYPE_LABELS: Record<SuspensionType, string> = {
  temporary: 'Suspensión temporal',
  provisional: 'Suspensión provisional',
  permanent: 'Suspensión permanente',
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
      {suspension.warning && (
        <p className='font-bold'>
          Si volvés a recibir denuncias, la suspensión puede pasar a ser permanente.
        </p>
      )}
    </div>
  )
}

export default SuspensionNotice
