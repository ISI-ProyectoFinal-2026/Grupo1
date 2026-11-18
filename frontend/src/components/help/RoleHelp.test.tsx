import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import RoleHelp from '@/components/help/RoleHelp'
import { resolveSectionHelp } from '@/constants/sectionHelp'
import { ROLE_LABELS } from '@/types/admin.types'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser, Role } from '@/types/auth'

const ROLES: Role[] = ['usuario_regular', 'moderador', 'admin']

function userWith(role: Role): AuthUser {
  return {
    id: 1,
    email: 'a@patitas.test',
    fullName: 'A',
    phone: null,
    role,
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function login(role: Role) {
  useAuthStore.setState({ token: 't', user: userWith(role) })
}

function renderHelp(path = '/', extra?: ReactNode, props: { raised?: boolean } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {extra}
      <RoleHelp {...props} />
    </MemoryRouter>
  )
}

const itemsOf = (path: string, role: Role) => {
  const help = resolveSectionHelp(path, role)
  return [...help.can, ...help.steps].flatMap((group) => group.items)
}

describe('RoleHelp', () => {
  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('no se muestra sin sesión', () => {
    renderHelp()
    expect(screen.queryByRole('button', { name: /Ayuda/ })).not.toBeInTheDocument()
  })

  it.each(ROLES)('en el menú principal para %s muestra solo su ayuda', async (role) => {
    login(role)
    const user = userEvent.setup()
    renderHelp('/')

    const button = screen.getByRole('button', { name: `Ayuda: Menú principal (${ROLE_LABELS[role]})` })
    expect(button).toHaveAttribute('data-role', role)
    await user.click(button)

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Menú principal' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Qué podés hacer' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Cómo' })).toBeInTheDocument()
    itemsOf('/', role).forEach((item) => expect(dialog).toHaveTextContent(item))
    expect(dialog.querySelector(`[data-role-icon="${role}"]`)).not.toBeNull()

    for (const other of ROLES.filter((r) => r !== role)) {
      itemsOf('/', other)
        .filter((item) => !itemsOf('/', role).includes(item))
        .forEach((item) => expect(dialog).not.toHaveTextContent(item))
    }
    expect(screen.queryByText(/tu rol/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/your role/i)).not.toBeInTheDocument()
  })

  it('muestra la sección de la ruta actual con el rol en el nombre accesible', async () => {
    login('moderador')
    const user = userEvent.setup()
    renderHelp('/chats/3')

    await user.click(screen.getByRole('button', { name: 'Ayuda: Chats (Moderador)' }))

    const dialog = screen.getByRole('dialog', { name: 'Ayuda: Chats (Moderador)' })
    expect(within(dialog).getByRole('heading', { name: 'Chats' })).toBeInTheDocument()
    itemsOf('/chats/3', 'moderador').forEach((item) => expect(dialog).toHaveTextContent(item))
    expect(dialog.querySelector('ol')).not.toBeNull()
  })

  it('muestra los grupos del detalle de reporte', async () => {
    login('usuario_regular')
    const user = userEvent.setup()
    renderHelp('/reports/8')

    await user.click(screen.getByRole('button', { name: /^Ayuda: Reporte/ }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByText('Si el reporte es tuyo').length).toBeGreaterThan(0)
    expect(within(dialog).getAllByText('Si es de otra persona').length).toBeGreaterThan(0)
  })

  it('cambia con la ruta y se cierra al navegar', async () => {
    login('usuario_regular')
    const user = userEvent.setup()
    renderHelp('/reports', <Link to='/pets'>ir</Link>)

    await user.click(screen.getByRole('button', { name: 'Ayuda: Reportes (Usuario)' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'ir' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ayuda: Mis mascotas (Usuario)' }))
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Mis mascotas' })).toBeInTheDocument()
  })

  it('abre y cierra con el botón, actualizando aria-expanded', async () => {
    login('moderador')
    const user = userEvent.setup()
    renderHelp('/')
    const button = screen.getByRole('button', { name: 'Ayuda: Menú principal (Moderador)' })

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-controls', screen.getByRole('dialog').id)
    await user.click(button)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('cierra con Escape y devuelve el foco al botón', async () => {
    login('admin')
    const user = userEvent.setup()
    renderHelp('/')
    const button = screen.getByRole('button', { name: 'Ayuda: Menú principal (Administrador)' })
    await user.click(button)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('cierra con el botón Cerrar y devuelve el foco', async () => {
    login('usuario_regular')
    const user = userEvent.setup()
    renderHelp('/')
    const button = screen.getByRole('button', { name: /^Ayuda:/ })
    await user.click(button)

    await user.click(screen.getByRole('button', { name: 'Cerrar ayuda' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('cierra al hacer click fuera y no al hacer click dentro', async () => {
    login('usuario_regular')
    const user = userEvent.setup()
    renderHelp('/', <p>afuera</p>)
    await user.click(screen.getByRole('button', { name: /^Ayuda:/ }))

    await user.click(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByText('afuera'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('no se oculta en mobile y sube sobre la barra de acciones', () => {
    login('usuario_regular')
    renderHelp('/reports/5')
    const contenedor = screen.getByRole('button', { name: /^Ayuda:/ }).parentElement
    expect(contenedor).not.toHaveClass('max-lg:hidden')
    expect(contenedor?.className).toContain('var(--help-bar-h')
  })

  it('en el chat se sube sobre el campo de mensaje', () => {
    login('usuario_regular')
    renderHelp('/chats/1', undefined, { raised: true })
    expect(screen.getByRole('button', { name: /^Ayuda:/ }).parentElement?.className).toContain(
      'max-lg:bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+5rem)]'
    )
  })
})
