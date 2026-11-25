import type { ReactNode } from 'react'

interface ErrorScreenProps {
  message: string
  actions: ReactNode
}

// pantalla de error inesperado (ErrorBoundary y errorElement del router)
export function ErrorScreen({ message, actions }: ErrorScreenProps) {
  return (
    <main className='flex min-h-screen items-center justify-center bg-surface px-4 py-12'>
      <div role='alert' className='card w-full max-w-md p-6'>
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
          <pre className='mt-2 whitespace-pre-wrap break-words font-mono text-xs'>{message}</pre>
        </details>
        <div className='mt-6 flex flex-col gap-3'>{actions}</div>
      </div>
    </main>
  )
}
