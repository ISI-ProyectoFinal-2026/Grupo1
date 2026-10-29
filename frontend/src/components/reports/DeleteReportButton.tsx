import { useState } from 'react'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'

interface DeleteReportButtonProps {
  onConfirm: () => void
  isPending?: boolean
  error?: string | null
}

// Same inline confirmation as CloseReportButton: deleting cannot be undone.
export default function DeleteReportButton({
  onConfirm,
  isPending = false,
  error = null,
}: DeleteReportButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  return (
    <div className='flex flex-col gap-3'>
      {isConfirming ? (
        <div className='flex flex-col gap-3'>
          <p className='text-ink'>
            ¿Seguro que querés eliminar este reporte? No se puede deshacer.
          </p>
          <div className='grid grid-cols-2 gap-2'>
            <Button variant='danger' isLoading={isPending} onClick={onConfirm}>
              Confirmar eliminación
            </Button>
            <Button variant='secondary' disabled={isPending} onClick={() => setIsConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant='secondary' className='w-full' onClick={() => setIsConfirming(true)}>
          Eliminar reporte
        </Button>
      )}
      {error && <ErrorMessage message={error} />}
    </div>
  )
}
