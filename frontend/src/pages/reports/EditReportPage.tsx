import { Link, useNavigate, useParams } from 'react-router-dom'
import { useReportDetailQuery } from '@/hooks/useReportDetailQuery'
import { useUpdateReport } from '@/hooks/useUpdateReport'
import { useAuthStore } from '@/stores/auth.store'
import ReportForm from '@/components/reports/ReportForm'
import Spinner from '@/components/ui/Spinner'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { buttonClasses } from '@/components/ui/buttonClasses'
import type { CreateReportFormData } from '@/types/validators/report.validator'

export default function EditReportPage() {
  const { id } = useParams<{ id: string }>()
  const reportId = Number(id)
  const navigate = useNavigate()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const { data: report, isLoading, error } = useReportDetailQuery(id ? reportId : undefined)
  const { update } = useUpdateReport(reportId)

  if (isLoading) {
    return (
      <div className='flex min-h-[60vh] items-center justify-center text-ink-muted'>
        <Spinner size='lg' />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className='mx-auto max-w-2xl px-4 py-8 sm:px-6'>
        <ErrorMessage message='Error al cargar el reporte' className='card p-4' />
        <Link to='/reports' className={buttonClasses('secondary', 'md', 'mt-4')}>
          Volver a reportes
        </Link>
      </div>
    )
  }

  // The backend enforces ownership too (403); this only avoids showing a form
  // that could never be saved.
  if (currentUserId !== report.userId) {
    return (
      <div className='mx-auto max-w-2xl px-4 py-8 sm:px-6'>
        <ErrorMessage message='No tenés permiso para editar este reporte.' className='card p-4' />
        <Link to={`/reports/${report.id}`} className={buttonClasses('secondary', 'md', 'mt-4')}>
          Volver al reporte
        </Link>
      </div>
    )
  }

  const handleSubmit = async (data: CreateReportFormData) => {
    await update(data)
    navigate(`/reports/${report.id}`, { state: { message: 'Reporte actualizado' } })
  }

  return (
    <div className='mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8'>
      <h1 className='font-display text-display-lg'>Editar reporte</h1>
      <div className='mt-6 sm:card sm:p-6'>
        <ReportForm
          mode='edit'
          initialData={{
            reportType: report.reportType,
            title: report.title,
            description: report.description ?? '',
            imageUrl: report.imageUrl ?? undefined,
            location: report.location ?? undefined,
            locationAddress: report.locationAddress ?? '',
            petId: report.petId ?? undefined,
          }}
          onSubmit={handleSubmit}
          canChangeImage={report.status !== 'resolved'}
        />
      </div>
    </div>
  )
}
