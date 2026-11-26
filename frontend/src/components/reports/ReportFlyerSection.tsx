import { useState } from 'react'
import Button from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import ErrorMessage from '@/components/ui/ErrorMessage'
import ImageUploader from '@/components/reports/ImageUploader'
import { useReportFlyer } from '@/hooks/useReportFlyer'
import { useSetCustomFlyer } from '@/hooks/useSetCustomFlyer'
import { EMAIL_NOT_VERIFIED } from '@/types/auth'

interface ReportFlyerSectionProps {
  reportId: number
  title: string
  customFlyerUrl: string | null
  canUploadCustom: boolean
}

async function shareFlyer(title: string, url: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return
    } catch {
      // el usuario canceló el share nativo, no hace falta avisar nada
    }
  }
  await navigator.clipboard.writeText(url)
}

// flyer generado o propio del reporte, con descarga y compartir
export default function ReportFlyerSection({
  reportId,
  title,
  customFlyerUrl,
  canUploadCustom,
}: ReportFlyerSectionProps) {
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null)
  const flyer = useReportFlyer(reportId, setFlyerUrl)
  const customFlyer = useSetCustomFlyer(reportId, setFlyerUrl)
  const displayFlyerUrl = flyerUrl ?? customFlyerUrl

  return (
    <section className='card mt-6 p-4 sm:p-5'>
      <h2 className='font-display text-display-sm text-ink'>Flyer para compartir</h2>
      {!displayFlyerUrl ? (
        <div className='mt-3 flex flex-col gap-3'>
          <Button
            variant='secondary'
            isLoading={flyer.isPending}
            onClick={flyer.generate}
            className='w-full sm:w-auto sm:self-start'
          >
            Generar flyer
          </Button>
          {canUploadCustom && (
            <>
              <p className='text-sm text-ink-muted'>o subí tu propio flyer</p>
              <ImageUploader
                onSuccess={customFlyer.save}
                onError={(message, code) => {
                  // El uploader ya muestra el aviso de email sin verificar.
                  if (code !== EMAIL_NOT_VERIFIED) customFlyer.showError(message)
                }}
              />
              {customFlyer.error && <ErrorMessage message={customFlyer.error} />}
            </>
          )}
        </div>
      ) : (
        <div className='mt-3 flex flex-col gap-4 sm:flex-row sm:items-start'>
          <img
            src={displayFlyerUrl}
            alt='Flyer del reporte'
            width={160}
            height={226}
            loading='lazy'
            className='w-40 rounded-control border border-line shadow-card'
          />
          <div className='grid grid-cols-2 gap-2 sm:flex'>
            <a
              href={displayFlyerUrl}
              download
              target='_blank'
              rel='noreferrer'
              className={buttonClasses('secondary')}
            >
              Descargar
            </a>
            <Button variant='primary' onClick={() => shareFlyer(title, displayFlyerUrl)}>
              Compartir
            </Button>
          </div>
        </div>
      )}
      {flyer.isError && (
        <ErrorMessage message='No se pudo generar el flyer, intentá de nuevo.' className='mt-2' />
      )}
    </section>
  )
}
