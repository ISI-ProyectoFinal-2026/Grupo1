import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'

// mismo esqueleto que el detalle: la foto y el título no saltan al cargar
export default function ReportDetailSkeleton() {
  return (
    <SkeletonGroup className='mx-auto max-w-6xl animate-fade px-4 pb-4 pt-2 sm:px-6 lg:py-6'>
      <Skeleton className='h-11 w-24' />
      <div className='mt-2 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-8'>
        <div>
          <Skeleton className='-mx-4 aspect-[4/3] rounded-none sm:mx-0 sm:rounded-card' />
          <Skeleton className='mt-5 h-9 w-3/4' />
          <div className='mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Skeleton className='h-12' />
            <Skeleton className='h-12' />
          </div>
        </div>
        <Skeleton className='hidden h-40 rounded-card lg:block' />
      </div>
    </SkeletonGroup>
  )
}
