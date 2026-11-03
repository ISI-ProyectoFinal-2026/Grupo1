import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import * as adminService from '@/services/admin.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AdminUser, Paginated } from '@/types/admin.types'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/admin.service')

const YO: AuthUser = {
  id: 1,
  email: 'admin@example.com',
  fullName: 'Admin Root',
  phone: null,
  role: 'admin',
  emailVerifiedAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

function usuario(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 4,
    email: 'ana@example.com',
    fullName: 'Ana Pérez',
    role: 'usuario_regular',
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

const propio = usuario({ id: 1, email: 'admin@example.com', fullName: 'Admin Root', role: 'admin' })

function pagina(items: AdminUser[], extra: Partial<Paginated<AdminUser>> = {}) {
  return { items, total: items.length, page: 1, pageSize: 20, ...extra }
}

function errorConCodigo(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status })
}

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  render(
    <Wrapper>
      <AdminUsersPage />
    </Wrapper>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ token: 'token', user: YO })
  vi.mocked(adminService.listAdminUsers).mockResolvedValue(pagina([propio, usuario()]))
})

afterEach(() => {
  useAuthStore.setState({ token: null, user: null })
})

describe('AdminUsersPage: listado y filtros', () => {
  it('muestra nombre, email y rol de cada usuario', async () => {
    renderPage()

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByLabelText('Rol de Ana Pérez')).toHaveValue('usuario_regular')
    expect(screen.getByLabelText('Rol de Admin Root')).toHaveValue('admin')
  })

  it('usa el email como identificación cuando no hay nombre', async () => {
    vi.mocked(adminService.listAdminUsers).mockResolvedValue(pagina([usuario({ fullName: null })]))
    renderPage()

    expect(await screen.findByLabelText('Rol de ana@example.com')).toBeInTheDocument()
  })

  it('busca con demora, sin pedir en cada tecla, y vuelve a la página 1', async () => {
    renderPage()
    await screen.findByText('Ana Pérez')

    await userEvent.type(screen.getByLabelText('Buscar por nombre o email'), 'ana')

    await waitFor(() =>
      expect(adminService.listAdminUsers).toHaveBeenLastCalledWith({
        q: 'ana',
        role: '',
        page: 1,
        pageSize: 20,
      })
    )
    expect(adminService.listAdminUsers).not.toHaveBeenCalledWith(
      expect.objectContaining({ q: 'an' })
    )
  })

  it('filtra por rol', async () => {
    renderPage()
    await screen.findByText('Ana Pérez')

    await userEvent.selectOptions(screen.getByLabelText('Filtrar por rol'), 'moderador')

    await waitFor(() =>
      expect(adminService.listAdminUsers).toHaveBeenLastCalledWith({
        q: '',
        role: 'moderador',
        page: 1,
        pageSize: 20,
      })
    )
  })

  it('pagina con Anterior y Siguiente', async () => {
    vi.mocked(adminService.listAdminUsers).mockResolvedValue(
      pagina([usuario()], { total: 45, page: 1 })
    )
    renderPage()

    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() =>
      expect(adminService.listAdminUsers).toHaveBeenLastCalledWith({
        q: '',
        role: '',
        page: 2,
        pageSize: 20,
      })
    )
  })

  it('en la última página deshabilita Siguiente', async () => {
    vi.mocked(adminService.listAdminUsers).mockResolvedValue(pagina([usuario()], { total: 45 }))
    renderPage()
    await screen.findByText('Ana Pérez')

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled())
  })

  it('avisa cuando no hay resultados', async () => {
    vi.mocked(adminService.listAdminUsers).mockResolvedValue(pagina([]))
    renderPage()

    expect(await screen.findByText('No encontramos usuarios.')).toBeInTheDocument()
  })

  it('muestra el error de la API si falla la carga', async () => {
    vi.mocked(adminService.listAdminUsers).mockRejectedValue(new Error('Sin conexión'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
  })
})

describe('AdminUsersPage: cambio de rol', () => {
  it('deshabilita el control de rol en la fila propia y no en las demás', async () => {
    renderPage()

    expect(await screen.findByLabelText('Rol de Admin Root')).toBeDisabled()
    expect(screen.getByLabelText('Rol de Ana Pérez')).toBeEnabled()
  })

  it('cancelar la confirmación no envía ningún cambio', async () => {
    renderPage()

    await userEvent.selectOptions(await screen.findByLabelText('Rol de Ana Pérez'), 'moderador')
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Moderador')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(adminService.changeUserRole).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Rol de Ana Pérez')).toHaveValue('usuario_regular')
  })

  it('confirmar envía el cambio y cierra el diálogo', async () => {
    vi.mocked(adminService.changeUserRole).mockResolvedValue(usuario({ role: 'moderador' }))
    renderPage()

    await userEvent.selectOptions(await screen.findByLabelText('Rol de Ana Pérez'), 'moderador')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(adminService.changeUserRole).toHaveBeenCalledWith(4, 'moderador')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['SELF_ROLE_CHANGE', 400, 'No podés cambiar tu propio rol.'],
    ['ROLE_UNCHANGED', 400, 'El usuario ya tiene ese rol.'],
    ['LAST_ADMIN', 409, 'No se puede dejar al sistema sin administradores.'],
  ])('traduce el código %s a un mensaje', async (code, status, mensaje) => {
    vi.mocked(adminService.changeUserRole).mockRejectedValue(
      errorConCodigo('mensaje del backend', code, status)
    )
    renderPage()

    await userEvent.selectOptions(await screen.findByLabelText('Rol de Ana Pérez'), 'moderador')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('ante un error sin código muestra el mensaje de la API', async () => {
    vi.mocked(adminService.changeUserRole).mockRejectedValue(
      Object.assign(new Error('Error inesperado, intentá de nuevo'), { status: 500 })
    )
    renderPage()

    await userEvent.selectOptions(await screen.findByLabelText('Rol de Ana Pérez'), 'admin')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error inesperado, intentá de nuevo')
  })
})
