import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmRoleChangeDialog from '@/components/admin/ConfirmRoleChangeDialog'
import type { AdminUser } from '@/types/admin.types'

const objetivo: AdminUser = {
  id: 4,
  email: 'ana@example.com',
  fullName: 'Ana Pérez',
  role: 'usuario_regular',
  createdAt: '2026-09-01T10:00:00.000Z',
}

function renderDialog(overrides: Partial<Parameters<typeof ConfirmRoleChangeDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmRoleChangeDialog
      target={objetivo}
      newRole='moderador'
      isLoading={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  )
  return { onConfirm, onCancel }
}

describe('ConfirmRoleChangeDialog', () => {
  it('pregunta por el usuario y el rol nuevo en un alertdialog', () => {
    renderDialog()

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Ana Pérez')
    expect(dialog).toHaveTextContent('Moderador')
  })

  it('usa el email cuando el usuario no tiene nombre', () => {
    renderDialog({ target: { ...objetivo, fullName: null } })

    expect(screen.getByRole('alertdialog')).toHaveTextContent('ana@example.com')
  })

  it('al confirmar avisa con onConfirm', async () => {
    const { onConfirm, onCancel } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('al cancelar no confirma', async () => {
    const { onConfirm, onCancel } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('con Escape cancela sin confirmar', async () => {
    const { onConfirm, onCancel } = renderDialog()

    await userEvent.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('mientras envía deshabilita ambos botones', () => {
    renderDialog({ isLoading: true })

    // el spinner suma "Cargando" al nombre del botón
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })
})
