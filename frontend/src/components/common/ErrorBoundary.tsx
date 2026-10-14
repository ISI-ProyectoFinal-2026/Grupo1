import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'
import type { FallbackProps } from 'react-error-boundary'
import type { ReactNode } from 'react'
import { buttonClasses } from '@/components/ui/buttonClasses'

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

  return (
    <main className='flex min-h-screen items-center justify-center bg-surface px-4 py-12'>
      <div className='card w-full max-w-md p-6'>
        <div className='grid h-12 w-12 place-items-center rounded-full bg-danger-soft text-danger'>
          <svg aria-hidden='true' className='h-6 w-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
        </div>
        <h1 className='mt-4 font-display text-display-md'>Algo salió mal</h1>
        <p className='mt-2 text-ink-muted'>Disculpa, la aplicación encontró un error inesperado.</p>
        <details className='mt-4 max-h-40 overflow-auto rounded-control bg-surface p-3 text-sm text-ink'>
          <summary className='cursor-pointer font-bold'>Detalles técnicos</summary>
          <pre className='mt-2 whitespace-pre-wrap break-words font-mono text-xs'>{errorMessage}</pre>
        </details>
        <button type='button' onClick={resetErrorBoundary} className={buttonClasses('primary', 'lg', 'mt-6 w-full')}>
          Recargar página
        </button>
      </div>
    </main>
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
