import { useState } from 'react'
import { uploadCustomFlyer } from '@/services/reports.service'
import { getApiErrorStatus } from '@/services/api'

const GENERIC_ERROR_MESSAGE = 'No se pudo guardar el flyer, intentá de nuevo.'

export function useSetCustomFlyer(reportId: number, onSaved: (flyerUrl: string) => void) {
  const [error, setError] = useState<string | null>(null)

  const save = async (publicUrl: string) => {
    setError(null)
    try {
      await uploadCustomFlyer(reportId, publicUrl)
      onSaved(publicUrl)
    } catch (err) {
      // 422 sin animal y 409 oculto traen un mensaje para el usuario (#311)
      const status = getApiErrorStatus(err)
      setError(
        (status === 422 || status === 409) && err instanceof Error
          ? err.message
          : GENERIC_ERROR_MESSAGE
      )
    }
  }

  return { save, error, showError: setError }
}
