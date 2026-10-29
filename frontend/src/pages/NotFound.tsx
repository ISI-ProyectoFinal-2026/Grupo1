import { useNavigate } from 'react-router-dom'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { SniffingDog } from '@/components/ui/canine'
import { ChevronLeftIcon } from '@/components/ui/icons'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <main className='flex min-h-screen items-center justify-center bg-surface px-4 py-12'>
      <div className='w-full max-w-sm animate-rise text-center'>
        <SniffingDog className='mx-auto w-40' />
        <p className='tabular letra-filete mt-2 text-[6rem] leading-none text-ink'>
          404
        </p>
        <h1 className='mt-4 font-display text-display-md'>Página no encontrada</h1>
        <p className='mt-2 text-ink-muted'>La página que buscas no existe o fue movida.</p>
        {/* Microcopy decorativo */}
        <p className='mt-1 text-sm text-ink-muted'>Seguimos el rastro, pero por acá no pasó nadie.</p>

        <div className='mt-8 flex flex-col gap-3'>
          <button type='button' onClick={() => navigate('/')} className={buttonClasses('primary', 'lg', 'w-full')}>
            Ir a inicio
          </button>
          <button
            type='button'
            onClick={() => navigate(-1)}
            className={buttonClasses('secondary', 'lg', 'w-full')}
          >
            <ChevronLeftIcon className='h-5 w-5' />
            Volver atrás
          </button>
        </div>
      </div>
    </main>
  )
}
