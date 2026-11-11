import ErrorMessage from '@/components/ui/ErrorMessage'
import ReportFlagGroupList from '@/components/moderation/ReportFlagGroupList'
import Spinner from '@/components/ui/Spinner'
import { Link } from 'react-router-dom'
import { CheckIcon, ShieldIcon } from '@/components/ui/icons'
import { useModerateReportMutation, useReportFlagGroupsQuery } from '@/hooks/useReportFlagGroups'
import type { ModerationAction } from '@/types/moderation.types'
import { useAdFlagsQuery, useResolveAdFlagMutation } from '@/hooks/useServedAds'
import AdFlagList from '@/components/moderation/AdFlagList'
import ReportedAccountList from '@/components/moderation/ReportedAccountList'
import { useReportedAccountsQuery } from '@/hooks/useAccountReports'

const ACTION_SUCCESS_MESSAGES: Record<ModerationAction, string> = {
  hide: 'Reporte ocultado',
  dismiss: 'Denuncias descartadas, el reporte sigue publicado',
  restore: 'Reporte restaurado, vuelve a estar publicado',
  confirm: 'Ocultamiento confirmado',
}

function ModerationPage() {
  const groupsQuery = useReportFlagGroupsQuery()
  const moderate = useModerateReportMutation()

  return (
    <div className='mx-auto max-w-3xl px-4 py-5 sm:px-6 lg:py-8'>
      <h1 className='font-display text-display-lg'>Panel de moderación</h1>
      <p className='mt-2 max-w-prose text-ink-muted'>
        Publicaciones denunciadas pendientes de revisión, agrupadas por reporte. Los reportes ocultos automáticamente se
        restauran o se confirman; los publicados con denuncias se ocultan o se descartan.
      </p>

      <div className='mt-6' aria-live='polite'>
        {groupsQuery.isPending && (
          <div className='flex justify-center py-10 text-ink-muted'>
            <Spinner />
          </div>
        )}

        {groupsQuery.isError && <ErrorMessage message='No se pudo cargar la cola de moderación' />}

        {groupsQuery.isSuccess && (
          <>
            {moderate.isError && (
              <ErrorMessage
                className='mb-3'
                message={moderate.error instanceof Error ? moderate.error.message : 'Error inesperado, intentá de nuevo'}
              />
            )}
            {moderate.isSuccess && (
              <p className='mb-3 flex items-center gap-2 font-bold text-success-ink'>
                <CheckIcon className='h-5 w-5' />
                {ACTION_SUCCESS_MESSAGES[moderate.variables.action]}
              </p>
            )}

            <ReportFlagGroupList
              groups={groupsQuery.data}
              onAction={(reportId, action) => moderate.mutate({ reportId, action })}
              isActing={moderate.isPending}
            />
          </>
        )}
      </div>

      <ReportedAccountsSection />

      <AdModerationSection />
    </div>
  )
}

// denuncias de cuentas con gravedad (#267); la sanción al llegar al umbral es #38
function ReportedAccountsSection() {
  const accountsQuery = useReportedAccountsQuery()

  return (
    <section className='mt-10' aria-labelledby='account-moderation'>
      <h2 id='account-moderation' className='font-display text-display-md'>
        Cuentas denunciadas
      </h2>
      <p className='mt-2 max-w-prose text-ink-muted'>
        Al llegar a 5 denuncias de personas distintas se aplica la gravedad más frecuente; en empate, la más alta.
      </p>
      {/* aviso: al llegar al umbral la cuenta pasa a la cola de sanciones */}
      <p
        role='note'
        className='mt-3 flex items-start gap-2 rounded-card border border-signal-track bg-signal-soft p-4 text-sm text-ink'
      >
        <ShieldIcon className='mt-0.5 h-4 w-4 shrink-0' />
        <span>
          Cuando una cuenta llega a 5 denuncias sale de esta lista y pasa a{' '}
          <Link to='/admin/sanctions' className='font-bold underline'>
            Sanciones pendientes
          </Link>
          , donde se confirma o revierte la sanción.
        </span>
      </p>

      <div className='mt-4' aria-live='polite'>
        {accountsQuery.isPending && (
          <div className='flex justify-center py-10 text-ink-muted'>
            <Spinner />
          </div>
        )}
        {accountsQuery.isError && <ErrorMessage message='No se pudieron cargar las cuentas denunciadas' />}
        {accountsQuery.isSuccess && <ReportedAccountList accounts={accountsQuery.data} />}
      </div>
    </section>
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
