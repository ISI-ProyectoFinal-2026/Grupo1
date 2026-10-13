import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RecoveryCodesModal from '@/components/account/RecoveryCodesModal'

const CODIGOS = [
  'AAAAA-BBBBB',
  'CCCCC-DDDDD',
  'EEEEE-FFFFF',
  'GGGGG-HHHHH',
  'IIIII-JJJJJ',
  'KKKKK-LLLLL',
  'MMMMM-NNNNN',
  'OOOOO-PPPPP',
  'QQQQQ-RRRRR',
  'SSSSS-TTTTT',
]

function renderModal(codes = CODIGOS) {
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(<RecoveryCodesModal codes={codes} onClose={onClose} />)
  return { onClose, user }
}

describe('RecoveryCodesModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('muestra un dialogo modal con todos los codigos', () => {
    renderModal()

    const dialogo = screen.getByRole('dialog', { name: 'Tus códigos de recuperación' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByText('AAAAA-BBBBB')).toBeInTheDocument()
    expect(screen.getByText('SSSSS-TTTTT')).toBeInTheDocument()
  })

  it('muestra los codigos que recibe, no una lista fija', () => {
    renderModal(['ZZZZZ-YYYYY', 'XXXXX-WWWWW'])

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('ZZZZZ-YYYYY')).toBeInTheDocument()
    expect(screen.queryByText('AAAAA-BBBBB')).not.toBeInTheDocument()
  })

  it('avisa que se muestran una sola vez', () => {
    renderModal()

    expect(screen.getByText(/no vas a poder volver a verlos/i)).toBeInTheDocument()
  })

  it('arranca con el foco dentro del dialogo', () => {
    renderModal()

    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  describe('compuerta de confirmacion', () => {
    it('el boton de cerrar esta deshabilitado hasta confirmar que se guardaron', () => {
      renderModal()

      expect(screen.getByRole('checkbox', { name: 'Guardé mis códigos' })).not.toBeChecked()
      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled()
    })

    it('Escape no lo cierra', async () => {
      const { onClose, user } = renderModal()

      await user.keyboard('{Escape}')

      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('Escape tampoco lo cierra una vez confirmado: solo el boton', async () => {
      const { onClose, user } = renderModal()
      await user.click(screen.getByRole('checkbox', { name: 'Guardé mis códigos' }))

      await user.keyboard('{Escape}')

      expect(onClose).not.toHaveBeenCalled()
    })

    it('un click en el fondo no lo cierra', async () => {
      const { onClose, user } = renderModal()

      await user.click(screen.getByTestId('recovery-codes-overlay'))

      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('hacer click en el boton deshabilitado no cierra', async () => {
      const { onClose, user } = renderModal()

      await user.click(screen.getByRole('button', { name: 'Cerrar' }))

      expect(onClose).not.toHaveBeenCalled()
    })

    it('al confirmar se habilita el boton y cierra una sola vez', async () => {
      const { onClose, user } = renderModal()

      await user.click(screen.getByRole('checkbox', { name: 'Guardé mis códigos' }))
      const cerrar = screen.getByRole('button', { name: 'Cerrar' })
      expect(cerrar).toBeEnabled()
      await user.click(cerrar)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('desmarcar la confirmacion vuelve a bloquear el cierre', async () => {
      const { onClose, user } = renderModal()
      const confirmacion = screen.getByRole('checkbox', { name: 'Guardé mis códigos' })

      await user.click(confirmacion)
      await user.click(confirmacion)
      await user.click(screen.getByRole('button', { name: 'Cerrar' }))

      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled()
      expect(onClose).not.toHaveBeenCalled()
    })

    it('copiar o descargar no cuentan como confirmacion', async () => {
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:x'),
        revokeObjectURL: vi.fn(),
      })
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      const { onClose, user } = renderModal()

      await user.click(screen.getByRole('button', { name: 'Copiar códigos' }))
      await user.click(screen.getByRole('button', { name: 'Descargar códigos' }))

      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled()
      expect(onClose).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
    })
  })

  describe('foco', () => {
    it('Tab desde el ultimo control vuelve al primero: no sale del dialogo', async () => {
      const { user } = renderModal()
      await user.click(screen.getByRole('checkbox', { name: 'Guardé mis códigos' }))
      screen.getByRole('button', { name: 'Cerrar' }).focus()

      await user.tab()

      expect(screen.getByRole('button', { name: 'Copiar códigos' })).toHaveFocus()
    })

    it('Shift+Tab desde el primero salta al ultimo', async () => {
      const { user } = renderModal()
      await user.click(screen.getByRole('checkbox', { name: 'Guardé mis códigos' }))
      screen.getByRole('button', { name: 'Copiar códigos' }).focus()

      await user.tab({ shift: true })

      expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
    })
  })

  describe('copiar', () => {
    it('copia los codigos al portapapeles, uno por linea, y lo avisa', async () => {
      const { user } = renderModal()

      await user.click(screen.getByRole('button', { name: 'Copiar códigos' }))

      expect(await navigator.clipboard.readText()).toBe(CODIGOS.join('\n'))
      expect(await screen.findByText('Códigos copiados')).toBeInTheDocument()
    })

    it('si el portapapeles falla lo dice y no finge haber copiado', async () => {
      const { user } = renderModal()
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denegado'))

      await user.click(screen.getByRole('button', { name: 'Copiar códigos' }))

      expect(await screen.findByText(/No pudimos copiar/)).toBeInTheDocument()
      expect(screen.queryByText('Códigos copiados')).not.toBeInTheDocument()
    })
  })

  describe('descargar', () => {
    it('arma un .txt con un codigo por linea y lo descarga', async () => {
      const createObjectURL = vi.fn((_blob: Blob) => 'blob:codigos')
      const revokeObjectURL = vi.fn()
      vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
      const clicks: Array<{ download: string; href: string }> = []
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement
      ) {
        clicks.push({ download: this.download, href: this.href })
      })
      const { user } = renderModal()

      await user.click(screen.getByRole('button', { name: 'Descargar códigos' }))

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      const blob = createObjectURL.mock.calls[0][0]
      expect(await blob.text()).toBe(CODIGOS.join('\n'))
      expect(clicks).toEqual([
        { download: 'patitas-codigos-de-recuperacion.txt', href: 'blob:codigos' },
      ])
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:codigos')
      vi.unstubAllGlobals()
    })
  })
})
