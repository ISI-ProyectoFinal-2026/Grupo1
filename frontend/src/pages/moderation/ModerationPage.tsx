import ErrorMessage from '@/components/ui/ErrorMessage'
import ReportFlagList from '@/components/moderation/ReportFlagList'
import Spinner from '@/components/ui/Spinner'
import { CheckIcon } from '@/components/ui/icons'
import { useReportFlagsQuery, useResolveReportFlagMutation } from '@/hooks/useReportFlagsQuery'

function ModerationPage() {
  const flagsQuery = useReportFlagsQuery()
  const resolveFlag = useResolveReportFlagMutation()

  // El estado de la mutacion alcanza como feedback: no hace falta duplicarlo en
  // estado local, y al disparar la siguiente resolucion se limpia solo.
  const resolvingId = resolveFlag.isPending ? (resolveFlag.variables ?? null) : null

  return (
    <div className='mx-auto max-w-3xl px-4 py-5 sm:px-6 lg:py-8'>
      <h1 className='font-display text-display-lg'>Panel de moderación</h1>
      <p className='mt-2 max-w-prose text-ink-muted'>
        Publicaciones denunciadas pendientes de revisión. Resolver una denuncia oculta el reporte.
      </p>

      <div className='mt-6' aria-live='polite'>
        {flagsQuery.isPending && (
          <div className='flex justify-center py-10 text-ink-muted'>
            <Spinner />
          </div>
        )}

        {flagsQuery.isError && <ErrorMessage message='No se pudo cargar la cola de moderación' />}

        {flagsQuery.isSuccess && (
          <>
            {resolveFlag.isError && (
              <ErrorMessage
                className='mb-3'
                message={
                  resolveFlag.error instanceof Error
                    ? resolveFlag.error.message
                    : 'Error inesperado, intentá de nuevo'
                }
              />
            )}
            {resolveFlag.isSuccess && (
              <p className='mb-3 flex items-center gap-2 font-bold text-success-ink'>
                <CheckIcon className='h-5 w-5' />
                Reporte ocultado y denuncia resuelta
              </p>
            )}

            <ReportFlagList
              flags={flagsQuery.data}
              onResolve={(id) => resolveFlag.mutate(id)}
              resolvingId={resolvingId}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default ModerationPage
