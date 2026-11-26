import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import type { NavItemConfig } from '@/layouts/navItems'

interface TabLinkProps {
  item: NavItemConfig
  pathname: string
  onNavigate: () => void
}

export default function TabLink({ item, pathname, onNavigate }: TabLinkProps) {
  const active = item.isActive(pathname)
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex h-full min-h-11 flex-col items-center justify-center gap-0.5 rounded-control px-1 text-xs font-bold transition-colors duration-fast',
        'lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-base',
        active
          ? 'text-signal-ink lg:bg-signal-soft'
          : 'text-ink-muted hover:text-ink lg:hover:bg-ink/5'
      )}
    >
      <span
        className={cn(
          'grid h-7 w-12 place-items-center rounded-full transition-[background-color,transform] duration-press ease-out group-active:scale-90 lg:h-auto lg:w-auto lg:group-active:scale-100',
          active && 'bg-signal-track lg:bg-transparent'
        )}
      >
        <Icon className='h-[22px] w-[22px]' />
      </span>
      {item.label}
    </Link>
  )
}
