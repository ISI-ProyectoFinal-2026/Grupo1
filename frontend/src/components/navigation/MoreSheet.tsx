import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import {
  BellIcon,
  ListIcon,
  LogoutIcon,
  PawIcon,
  ShieldIcon,
  StoreIcon,
  UserIcon,
} from '@/components/ui/icons'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useIsModerator } from '@/hooks/useIsModerator'
import { isOwnBusinessPath, isOwnPetsPath } from '@/layouts/navItems'
import { cn } from '@/lib/cn'

interface MoreSheetProps {
  pathname: string
  isOpen: boolean
  email: string
  onClose: () => void
  onLogout: () => void
}

interface MoreLinkProps {
  to: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  active: boolean
  onNavigate: () => void
  children: ReactNode
}

const moreLinkClasses = (active: boolean) =>
  cn(
    'press flex min-h-12 items-center gap-3 rounded-control px-3 text-base font-bold lg:min-h-11',
    active ? 'bg-signal-soft text-signal-ink' : 'text-ink-muted hover:bg-ink/5 hover:text-ink'
  )

function MoreLink({ to, icon: Icon, active, onNavigate, children }: MoreLinkProps) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={moreLinkClasses(active)}
    >
      <Icon className='h-5 w-5' />
      {children}
    </Link>
  )
}

// Mismo bloque en ambos tamaños: hoja inferior en mobile (se abre con "Más")
// y pie del sidebar en desktop, siempre visible.
export default function MoreSheet({ pathname, isOpen, email, onClose, onLogout }: MoreSheetProps) {
  const isModerator = useIsModerator()
  const isAdmin = useIsAdmin()

  return (
    <>
      {isOpen && (
        <button
          type='button'
          aria-label='Cerrar menú'
          tabIndex={-1}
          onClick={onClose}
          className='fixed inset-0 -z-10 animate-fade bg-ink/40 lg:hidden'
        />
      )}

      <div
        id='menu-mas'
        className={cn(
          isOpen ? 'flex' : 'hidden',
          'fixed inset-x-0 bottom-above-tabbar flex-col gap-1 overscroll-contain rounded-t-card border-t border-line bg-paper p-3 shadow-sheet',
          isOpen && 'max-lg:animate-sheet',
          'lg:static lg:mt-auto lg:flex lg:rounded-none lg:shadow-none'
        )}
      >
        <MoreLink to='/pets' icon={PawIcon} active={isOwnPetsPath(pathname)} onNavigate={onClose}>
          Mis mascotas
        </MoreLink>
        <MoreLink
          to='/reports/mine'
          icon={ListIcon}
          active={pathname === '/reports/mine'}
          onNavigate={onClose}
        >
          Mis reportes
        </MoreLink>
        <MoreLink
          to='/businesses/dashboard'
          icon={StoreIcon}
          active={isOwnBusinessPath(pathname)}
          onNavigate={onClose}
        >
          Mi comercio
        </MoreLink>
        {isModerator && (
          <MoreLink
            to='/moderation'
            icon={ShieldIcon}
            active={pathname === '/moderation'}
            onNavigate={onClose}
          >
            Moderación
          </MoreLink>
        )}
        {isAdmin && (
          <MoreLink
            to='/admin/users'
            icon={UserIcon}
            active={pathname === '/admin/users'}
            onNavigate={onClose}
          >
            Administración
          </MoreLink>
        )}
        {isModerator && (
          <MoreLink
            to='/admin/sanctions'
            icon={ShieldIcon}
            active={pathname === '/admin/sanctions'}
            onNavigate={onClose}
          >
            Sanciones
          </MoreLink>
        )}

        <div className='mt-2 flex flex-col border-t border-line pt-3'>
          <MoreLink
            to='/account/profile'
            icon={UserIcon}
            active={pathname === '/account/profile'}
            onNavigate={onClose}
          >
            Mi cuenta
          </MoreLink>
          <MoreLink
            to='/account/notifications'
            icon={BellIcon}
            active={pathname === '/account/notifications'}
            onNavigate={onClose}
          >
            Notificaciones
          </MoreLink>
          <Link
            to='/account/security'
            onClick={onClose}
            aria-label={`Seguridad de la cuenta: ${email}`}
            aria-current={pathname === '/account/security' ? 'page' : undefined}
            className={cn(moreLinkClasses(pathname === '/account/security'), 'min-w-0 text-sm')}
          >
            <UserIcon className='h-5 w-5 shrink-0' />
            <span className='min-w-0 truncate' title={email}>
              {email}
            </span>
          </Link>
          <button
            type='button'
            onClick={onLogout}
            className='press mt-1 inline-flex min-h-11 items-center gap-3 rounded-control px-3 text-base font-bold text-ink hover:bg-ink/5'
          >
            <LogoutIcon className='h-5 w-5' />
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  )
}
