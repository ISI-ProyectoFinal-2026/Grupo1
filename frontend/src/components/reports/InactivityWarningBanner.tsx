import { useState } from 'react'
import InactivityWarningActions from '@/components/notifications/InactivityWarningActions'
import { useInactivityWarningQuery } from '@/hooks/useInactivityWarningQuery'
import { useAuthStore } from '@/stores/auth.store'
import type { ReportDTO } from '@/types/report.types'

interface InactivityWarningBannerProps {
  report: Pick<ReportDTO, 'id' | 'userId' | 'status'>
}

const CLOSING_TEXT = { 30: 'en unos días', 37: 'mañana' } as const

function InactivityWarningBanner({ report }: InactivityWarningBannerProps) {
  const currentUserId = useAuthStore((state) => state.user?.id)
  const enabled = currentUserId === report.userId && report.status === 'published'
  const { data } = useInactivityWarningQuery(report.id, enabled)
  const [acted, setActed] = useState(false)

  const pending = enabled && data?.pending === true
  // sigue montado solo si se respondió desde acá, para conservar la confirmación (#332)
  if (!pending && !acted) return null

  return (
    <div className='card flex flex-col gap-1 border-signal p-4'>
      {pending && (
        <p className='text-ink'>
          Tu reporte lleva {data.day} días sin actividad. Si no respondés, lo cerraremos{' '}
          {data.day ? CLOSING_TEXT[data.day] : 'pronto'}.
        </p>
      )}
      <InactivityWarningActions reportId={report.id} isRead={false} onAction={() => setActed(true)} />
    </div>
  )
}

export default InactivityWarningBanner
