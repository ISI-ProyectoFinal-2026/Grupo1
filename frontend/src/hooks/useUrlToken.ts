import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * Lee `?token=` de un link de email y lo saca de la URL enseguida, para que no
 * quede en el historial, en un screenshot ni en el Referer de lo que se abra
 * después. El valor se guarda en el state inicial: sobrevive al re-render que provoca
 * sacarlo y a los dos montajes de StrictMode (el guard evita navegar dos veces).
 */
export function useUrlToken(): string | null {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [token] = useState(() => searchParams.get('token'))
  const strippedRef = useRef(false)

  useEffect(() => {
    if (strippedRef.current) return
    strippedRef.current = true
    navigate({ search: '' }, { replace: true })
  }, [navigate])

  return token
}
