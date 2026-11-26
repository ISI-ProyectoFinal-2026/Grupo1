import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'
import type { FallbackProps } from 'react-error-boundary'
import type { ReactNode } from 'react'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { ErrorScreen } from './ErrorScreen'

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

  return (
    <ErrorScreen
      message={errorMessage}
      actions={
        <button type='button' onClick={resetErrorBoundary} className={buttonClasses('primary', 'lg', 'w-full')}>
          Recargar página
        </button>
      }
    />
  )
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => (window.location.href = '/')}
    >
      {children}
    </ReactErrorBoundary>
  )
}
