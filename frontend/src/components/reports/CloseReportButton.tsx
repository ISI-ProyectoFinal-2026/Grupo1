import { useState } from 'react'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'

interface CloseReportButtonProps {
  onConfirm: () => void
  isPending?: boolean
  error?: string | null
}

// Confirmación en línea en vez de window.confirm: no bloquea la página y se
// puede manejar igual que cualquier otro botón (también desde los e2e).
export default function CloseReportButton({
  onConfirm,
  isPending = false,
  error = null,
}: CloseReportButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  return (
    <div className='flex flex-col gap-3'>
      {isConfirming ? (
        <div className='flex flex-col gap-3'>
          <p className='text-sm text-gray-700'>
            ¿Seguro que querés cerrar este reporte? Va a quedar como resuelto.
          </p>
          <div className='flex gap-3'>
            <Button variant='danger' isLoading={isPending} onClick={onConfirm}>
              Confirmar cierre
            </Button>
            <Button variant='secondary' disabled={isPending} onClick={() => setIsConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant='secondary' className='self-start' onClick={() => setIsConfirming(true)}>
          Cerrar reporte
        </Button>
      )}
      {error && <ErrorMessage message={error} />}
    </div>
  )
}
