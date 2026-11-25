import type { ComponentType, SVGProps } from 'react'
import { ChatIcon, ListIcon, StoreIcon } from '@/components/ui/icons'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

export interface NavItemConfig {
  to: string
  label: string
  icon: IconComponent
  isActive: (pathname: string) => boolean
}

// El match de cada item se resuelve a mano en lugar de con NavLink: /reports/new
// pertenece a "Reportar" (no a "Reportes") y /businesses/dashboard o /plan a "Mi comercio"
// (no a "Comercios"), cosa que el match por prefijo de NavLink no distingue.
const isReportsPath = (path: string) =>
  path === '/reports' ||
  (path.startsWith('/reports/') && path !== '/reports/new' && path !== '/reports/mine')
export const isOwnBusinessPath = (path: string) =>
  path === '/businesses/dashboard' || path === '/businesses/register' || path === '/businesses/plan'
export const isOwnPetsPath = (path: string) => path === '/pets' || path.startsWith('/pets/')
// en el login y el registro los accesos de invitado sobran
export const isAuthFormPath = (path: string) => path === '/login' || path === '/register'
// páginas públicas a las que vuelve el login; no los links de email, de un solo uso (#187)
export const isPublicBrowsePath = (path: string) =>
  path === '/reports' ||
  path.startsWith('/reports/') ||
  path === '/businesses' ||
  path.startsWith('/businesses/')

// rutas que viven en la hoja "Más"
export const isMorePath = (path: string) =>
  isOwnPetsPath(path) ||
  isOwnBusinessPath(path) ||
  path === '/moderation' ||
  path === '/admin/users' ||
  path === '/admin/sanctions' ||
  path === '/account/profile' ||
  path === '/account/security' ||
  path === '/account/notifications'

export const PRIMARY_ITEMS: NavItemConfig[] = [
  { to: '/reports', label: 'Reportes', icon: ListIcon, isActive: isReportsPath },
  {
    to: '/chats',
    label: 'Chats',
    icon: ChatIcon,
    isActive: (p) => p === '/chats' || p.startsWith('/chats/'),
  },
]

export const SECONDARY_ITEMS: NavItemConfig[] = [
  {
    to: '/businesses',
    label: 'Comercios',
    icon: StoreIcon,
    isActive: (p) => (p === '/businesses' || p.startsWith('/businesses/')) && !isOwnBusinessPath(p),
  },
]
