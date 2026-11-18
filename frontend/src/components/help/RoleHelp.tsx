import { useEffect, useId, useRef, useState, type ComponentType, type SVGProps } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { resolveSectionHelp, type HelpGroup } from '@/constants/sectionHelp'
import { ROLE_LABELS } from '@/types/admin.types'
import type { Role } from '@/types/auth'
import { InfoIcon, PawIcon, ShieldIcon, UserIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

// identificador visual por rol: icono + acento
const ROLE_STYLE: Record<Role, { icon: IconComponent; badge: string }> = {
  usuario_regular: { icon: PawIcon, badge: 'bg-signal-soft text-signal-ink' },
  moderador: { icon: ShieldIcon, badge: 'bg-found-soft text-found' },
  admin: { icon: UserIcon, badge: 'bg-caramel-soft text-ink' },
}

function HelpList({ groups, ordered }: { groups: HelpGroup[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul'
  return (
    <>
      {groups.map((group, index) => (
        <div key={group.heading ?? index} className='space-y-1'>
          {group.heading && <h4 className='font-bold'>{group.heading}</h4>}
          <List className={cn('space-y-1.5 pl-5 text-ink-muted', ordered ? 'list-decimal' : 'list-disc')}>
            {group.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </List>
        </div>
      ))}
    </>
  )
}

function RoleHelp({ raised = false }: { raised?: boolean }) {
  const role = useAuthStore((state) => state.user?.role)
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [openPathname, setOpenPathname] = useState(pathname)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // al navegar el panel se cierra
  if (openPathname !== pathname) {
    setOpenPathname(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  if (!role) return null

  const help = resolveSectionHelp(pathname, role)
  const name = `Ayuda: ${help.title} (${ROLE_LABELS[role]})`
  const { icon: RoleIcon, badge } = ROLE_STYLE[role]

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div
      ref={rootRef}
      // z-20: debajo de la barra de navegación (z-30), la hoja "Más" y los modales (z-50);
      // --help-bar-h lo sube sobre la barra de acciones del detalle de reporte
      className={cn(
        'fixed right-3 z-20 flex flex-col items-end gap-2',
        'bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+var(--help-bar-h,0px)+0.75rem)] lg:bottom-4 lg:right-4',
        // en el chat, por encima del campo de mensaje
        raised && 'max-lg:bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+5rem)] lg:bottom-20'
      )}
    >
      {open && (
        <div
          id={panelId}
          role='dialog'
          aria-label={name}
          className='max-h-[60vh] w-[min(22rem,calc(100vw-1.5rem))] origin-bottom-right animate-pop overflow-y-auto overscroll-contain rounded-card border border-line bg-paper shadow-pop'
        >
          <div className='sticky top-0 flex items-center gap-3 border-b border-line bg-paper px-4 py-3'>
            <span data-role-icon={role} className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', badge)}>
              <RoleIcon className='h-5 w-5' />
            </span>
            <h2 className='flex-1 font-display text-display-sm'>{help.title}</h2>
            <button
              ref={closeRef}
              type='button'
              aria-label='Cerrar ayuda'
              onClick={close}
              className='press grid h-11 w-11 place-items-center rounded-full text-xl leading-none text-ink hover:bg-ink/5'
            >
              <span aria-hidden='true'>×</span>
            </button>
          </div>
          <div className='space-y-4 px-4 py-3 text-sm'>
            <section className='space-y-2'>
              <h3 className='font-display font-bold'>Qué podés hacer</h3>
              <HelpList groups={help.can} />
            </section>
            {help.steps.length > 0 && (
              <section className='space-y-2'>
                <h3 className='font-display font-bold'>Cómo</h3>
                <HelpList groups={help.steps} ordered />
              </section>
            )}
          </div>
        </div>
      )}

      <button
        ref={buttonRef}
        type='button'
        data-role={role}
        aria-label={name}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((previous) => !previous)}
        className={cn(
          'press relative grid h-12 w-12 place-items-center rounded-full border border-line shadow-pop',
          badge
        )}
      >
        <RoleIcon className='h-6 w-6' />
        <span className='absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-paper text-ink ring-1 ring-line'>
          <InfoIcon className='h-3.5 w-3.5' />
        </span>
      </button>
    </div>
  )
}

export default RoleHelp
