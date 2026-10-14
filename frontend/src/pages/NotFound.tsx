import { useNavigate } from 'react-router-dom'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { PawIcon } from '@/components/ui/icons'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <main className='flex min-h-screen items-center justify-center bg-surface px-4 py-12'>
      <div className='w-full max-w-sm text-center'>
        <PawIcon className='mx-auto h-10 w-10 -rotate-12 text-ink-muted' />
        <p className='tabular mt-4 font-display text-[6rem] font-extrabold leading-none tracking-tight text-ink'>
          404
        </p>
        <h1 className='mt-4 font-display text-display-md'>Página no encontrada</h1>
        <p className='mt-2 text-ink-muted'>La página que buscas no existe o fue movida.</p>

        <div className='mt-8 flex flex-col gap-3'>
          <button type='button' onClick={() => navigate('/')} className={buttonClasses('primary', 'lg', 'w-full')}>
            Ir a inicio
          </button>
          <button
            type='button'
            onClick={() => navigate(-1)}
            className={buttonClasses('secondary', 'lg', 'w-full')}
          >
            ← Volver atrás
          </button>
        </div>
      </div>
    </main>
  )
}
