import { Link } from 'react-router-dom'
import { PawIcon } from '@/components/ui/icons'

export default function Wordmark() {
  return (
    <Link
      to='/'
      translate='no'
      className='inline-flex min-h-11 items-center gap-2.5 rounded-control text-ink'
    >
      {/* Chapita de collar: argolla arriba */}
      <span className='relative grid h-9 w-9 -rotate-6 place-items-center rounded-full bg-signal text-ink'>
        <span
          aria-hidden='true'
          className='absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-ink/70 bg-paper'
        />
        <PawIcon className='h-5 w-5' />
      </span>
      <span className='letra-filete text-[1.625rem] leading-none'>PATITAS</span>
    </Link>
  )
}
