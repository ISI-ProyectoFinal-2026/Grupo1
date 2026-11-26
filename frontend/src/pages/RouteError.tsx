import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { buttonClasses } from '@/components/ui/buttonClasses'
import NotFound from './NotFound'

function describeError(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`.trim()
  if (error instanceof Error) return error.message
  return 'Error desconocido'
}

// errorElement de la ruta raíz (#329): 404 real o error inesperado
export default function RouteError() {
  const error = useRouteError()
  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  useEffect(() => {
    if (!isNotFound) console.error('[router] error inesperado al renderizar la ruta:', error)
  }, [error, isNotFound])

  if (isNotFound) return <NotFound />

  return (
    <ErrorScreen
      message={describeError(error)}
      actions={
        <>
          <button
            type='button'
            onClick={() => window.location.reload()}
            className={buttonClasses('primary', 'lg', 'w-full')}
          >
            Reintentar
          </button>
          <Link to='/' className={buttonClasses('secondary', 'lg', 'w-full')}>
            Ir a inicio
          </Link>
        </>
      }
    />
  )
}
