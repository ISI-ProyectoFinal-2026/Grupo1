import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'
import type { FallbackProps } from 'react-error-boundary'
import type { ReactNode } from 'react'

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

  return (
    <div className='min-h-screen flex items-center justify-center bg-red-50 px-4'>
      <div className='max-w-md w-full'>
        <div className='bg-white rounded-lg shadow-lg p-6'>
          <div className='flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full'>
            <svg
              className='w-6 h-6 text-red-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
          </div>
          <h3 className='mt-4 text-lg font-semibold text-center text-gray-900'>Algo salió mal</h3>
          <p className='mt-2 text-sm text-gray-600 text-center'>
            Disculpa, la aplicación encontró un error inesperado.
          </p>
          <details className='mt-4 p-3 bg-gray-50 rounded text-xs text-gray-700 overflow-auto max-h-32'>
            <summary className='cursor-pointer font-semibold'>Detalles técnicos</summary>
            <pre className='mt-2 whitespace-pre-wrap'>{errorMessage}</pre>
          </details>
          <button
            onClick={resetErrorBoundary}
            className='mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium'
          >
            Recargar página
          </button>
        </div>
      </div>
    </div>
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
