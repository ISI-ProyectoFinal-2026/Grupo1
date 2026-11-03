import { Link } from 'react-router-dom'
import MyReportCard from '@/components/reports/MyReportCard'
import { buttonClasses } from '@/components/ui/buttonClasses'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { PlusIcon } from '@/components/ui/icons'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { useMyReportsQuery } from '@/hooks/useMyReportsQuery'

export default function MyReportsPage() {
  const reportsQuery = useMyReportsQuery()

  return (
    <div className='mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='font-display text-display-lg'>Mis reportes</h1>
        <Link to='/reports/new' className={buttonClasses('signal')}>
          <PlusIcon className='h-5 w-5' />
          Nuevo reporte
        </Link>
      </div>

      <div className='mt-6'>
        {reportsQuery.isLoading ? (
          <SkeletonGroup className='flex animate-fade flex-col gap-4'>
            {[0, 1, 2].map((key) => (
              <div key={key} className='card flex flex-col gap-3 p-4'>
                <div className='flex items-center gap-4'>
                  <Skeleton className='size-20 shrink-0 rounded-control' />
                  <div className='flex flex-1 flex-col gap-2'>
                    <Skeleton className='h-5 w-2/3' />
                    <Skeleton className='h-4 w-1/3' />
                  </div>
                </div>
                <div className='grid grid-cols-2 gap-2'>
                  <Skeleton className='h-11 rounded-control' />
                  <Skeleton className='h-11 rounded-control' />
                </div>
              </div>
            ))}
          </SkeletonGroup>
        ) : reportsQuery.isError ? (
          <ErrorMessage message='No se pudieron cargar tus reportes' />
        ) : reportsQuery.data?.length === 0 ? (
          <EmptyState>
            <p className='text-ink-muted'>Todavía no publicaste ningún reporte.</p>
          </EmptyState>
        ) : (
          <ul className='stagger flex flex-col gap-4'>
            {reportsQuery.data?.map((report) => (
              <MyReportCard key={report.id} report={report} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
