import ErrorMessage from '@/components/ui/ErrorMessage'
import ReportFlagList from '@/components/moderation/ReportFlagList'
import Spinner from '@/components/ui/Spinner'
import { CheckIcon } from '@/components/ui/icons'
import { useReportFlagsQuery, useResolveReportFlagMutation } from '@/hooks/useReportFlagsQuery'
import { useAdFlagsQuery, useResolveAdFlagMutation } from '@/hooks/useServedAds'
import AdFlagList from '@/components/moderation/AdFlagList'

function ModerationPage() {
  const flagsQuery = useReportFlagsQuery()
  const resolveFlag = useResolveReportFlagMutation()

  return (
    <div className='mx-auto max-w-3xl px-4 py-5 sm:px-6 lg:py-8'>
      <h1 className='font-display text-display-lg'>Panel de moderación</h1>
      <p className='mt-2 max-w-prose text-ink-muted'>
        Publicaciones denunciadas pendientes de revisión. Aceptar una denuncia oculta el reporte; descartarla lo deja publicado.
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
                {resolveFlag.data.status === 'reviewed'
                  ? 'Reporte ocultado y denuncia aceptada'
                  : 'Denuncia descartada, el reporte sigue publicado'}
              </p>
            )}

            <ReportFlagList
              flags={flagsQuery.data}
              onResolve={(id, action) => resolveFlag.mutate({ id, action })}
              isResolving={resolveFlag.isPending}
            />
          </>
        )}
      </div>

      <AdModerationSection />
    </div>
  )
}

// denuncias de anuncios: dar de baja o desestimar (ADR-0024)
function AdModerationSection() {
  const adFlagsQuery = useAdFlagsQuery()
  const resolveAdFlag = useResolveAdFlagMutation()

  return (
    <section className='mt-10' aria-labelledby='ad-moderation'>
      <h2 id='ad-moderation' className='font-display text-display-md'>
        Anuncios denunciados
      </h2>
      <p className='mt-2 max-w-prose text-ink-muted'>
        Dar de baja oculta el anuncio y cierra sus demás denuncias. Desestimar deja el anuncio publicado.
      </p>

      <div className='mt-4' aria-live='polite'>
        {adFlagsQuery.isPending && (
          <div className='flex justify-center py-10 text-ink-muted'>
            <Spinner />
          </div>
        )}
        {adFlagsQuery.isError && <ErrorMessage message='No se pudieron cargar las denuncias de anuncios' />}
        {adFlagsQuery.isSuccess && (
          <>
            {resolveAdFlag.isError && <ErrorMessage className='mb-3' message={resolveAdFlag.error.message} />}
            {resolveAdFlag.isSuccess && (
              <p className='mb-3 flex items-center gap-2 font-bold text-success-ink'>
                <CheckIcon className='h-5 w-5' />
                {resolveAdFlag.data.status === 'removed' ? 'Anuncio dado de baja' : 'Denuncia desestimada'}
              </p>
            )}
            <AdFlagList
              flags={adFlagsQuery.data}
              onResolve={(id, action) => resolveAdFlag.mutate({ id, action })}
              isResolving={resolveAdFlag.isPending}
            />
          </>
        )}
      </div>
    </section>
  )
}

export default ModerationPage
