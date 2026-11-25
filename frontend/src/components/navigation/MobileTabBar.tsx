import { Link } from 'react-router-dom'
import TabLink from '@/components/navigation/TabLink'
import { MoreIcon, PlusIcon } from '@/components/ui/icons'
import { isMorePath, PRIMARY_ITEMS, SECONDARY_ITEMS } from '@/layouts/navItems'
import { cn } from '@/lib/cn'

interface MobileTabBarProps {
  pathname: string
  isMoreOpen: boolean
  onToggleMore: () => void
  onNavigate: () => void
}

// barra inferior en mobile; en desktop la misma lista arma el sidebar
export default function MobileTabBar({
  pathname,
  isMoreOpen,
  onToggleMore,
  onNavigate,
}: MobileTabBarProps) {
  const isReportarActive = pathname === '/reports/new'
  const isMoreHighlighted = isMorePath(pathname) || isMoreOpen

  return (
    <ul className='relative mx-auto grid h-tabbar bg-paper max-w-lg grid-cols-5 items-stretch px-1 lg:mx-0 lg:flex lg:h-auto lg:max-w-none lg:flex-col lg:gap-1 lg:p-3'>
      {PRIMARY_ITEMS.map((item) => (
        <li key={item.to}>
          <TabLink item={item} pathname={pathname} onNavigate={onNavigate} />
        </li>
      ))}

      <li className='flex justify-center lg:order-first lg:mb-3 lg:block'>
        <Link
          to='/reports/new'
          onClick={onNavigate}
          aria-current={isReportarActive ? 'page' : undefined}
          className={cn(
            'group flex h-full flex-col items-center justify-center gap-0.5 text-xs font-bold text-ink',
            'lg:press lg:h-auto lg:min-h-12 lg:flex-row lg:gap-2 lg:rounded-full lg:bg-signal lg:px-4 lg:text-base lg:hover:bg-signal-deep'
          )}
        >
          <span className='-my-1 grid h-10 w-12 place-items-center rounded-full bg-signal ring-4 ring-paper transition-transform duration-press ease-out group-active:scale-90 lg:my-0 lg:h-auto lg:w-auto lg:bg-transparent lg:ring-0 lg:group-active:scale-100'>
            <PlusIcon className='h-6 w-6 lg:h-5 lg:w-5' strokeWidth={2.5} />
          </span>
          Reportar
        </Link>
      </li>

      {SECONDARY_ITEMS.map((item) => (
        <li key={item.to}>
          <TabLink item={item} pathname={pathname} onNavigate={onNavigate} />
        </li>
      ))}

      <li className='lg:hidden'>
        <button
          type='button'
          aria-expanded={isMoreOpen}
          aria-controls='menu-mas'
          onClick={onToggleMore}
          className={cn(
            'group flex h-full min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-control text-xs font-bold transition-colors duration-fast',
            isMoreHighlighted ? 'text-signal-ink' : 'text-ink-muted hover:text-ink'
          )}
        >
          <span
            className={cn(
              'grid h-7 w-12 place-items-center rounded-full transition-[background-color,transform] duration-press ease-out group-active:scale-90',
              isMoreHighlighted && 'bg-signal-track'
            )}
          >
            <MoreIcon className='h-[22px] w-[22px]' />
          </span>
          Más
        </button>
      </li>
    </ul>
  )
}
