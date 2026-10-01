import ErrorMessage from '@/components/ui/ErrorMessage'
import ReportFlagList from '@/components/moderation/ReportFlagList'
import Spinner from '@/components/ui/Spinner'
import { useReportFlagsQuery, useResolveReportFlagMutation } from '@/hooks/useReportFlagsQuery'

function ModerationPage() {
  const flagsQuery = useReportFlagsQuery()
  const resolveFlag = useResolveReportFlagMutation()

  // El estado de la mutacion alcanza como feedback: no hace falta duplicarlo en
  // estado local, y al disparar la siguiente resolucion se limpia solo.
  const resolvingId = resolveFlag.isPending ? (resolveFlag.variables ?? null) : null

  return (
    <div className='p-6'>
      <div className='mx-auto max-w-2xl'>
        <h1 className='text-2xl font-bold text-gray-900'>Panel de moderación</h1>
        <p className='mt-1 text-sm text-gray-600'>
          Publicaciones denunciadas pendientes de revisión. Resolver una denuncia oculta el reporte.
        </p>

        <div className='mt-6'>
          {flagsQuery.isPending && <Spinner />}

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
                <p className='mb-3 text-sm text-green-600'>Reporte ocultado y denuncia resuelta</p>
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
    </div>
  )
}

export default ModerationPage
