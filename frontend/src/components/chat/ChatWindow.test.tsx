import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChatWindow from '@/components/chat/ChatWindow'
import { getPresignedUrl, uploadToR2 } from '@/services/uploads.service'
import type { ChatConnectionStatus, MessageDTO } from '@/types/chat.types'

vi.mock('@/services/uploads.service', async (importOriginal) => {
  // Se conservan MAX_UPLOAD_BYTES y ALLOWED_UPLOAD_TYPES: son los limites
  // reales que el componente usa para validar antes de subir.
  const original = await importOriginal<typeof import('@/services/uploads.service')>()
  return { ...original, getPresignedUrl: vi.fn(), uploadToR2: vi.fn() }
})

const USUARIO_ACTUAL = 7

function mensaje(overrides: Partial<MessageDTO> = {}): MessageDTO {
  return {
    id: 1,
    chatId: 3,
    senderId: 8,
    content: 'Hola, creo que vi a tu perro',
    imageUrl: null,
    createdAt: '2026-09-22T10:05:00.000Z',
    ...overrides,
  }
}

function renderWindow(props: Partial<Parameters<typeof ChatWindow>[0]> = {}) {
  const onSend = vi.fn().mockResolvedValue(undefined)
  render(
    <MemoryRouter>
      <ChatWindow
        messages={[mensaje()]}
        currentUserId={USUARIO_ACTUAL}
        connectionStatus='connected'
        isLoading={false}
        loadError={null}
        sendError={null}
        onSend={onSend}
        {...props}
      />
    </MemoryRouter>
  )
  return { onSend: props.onSend ?? onSend }
}

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom no implementa scrollIntoView y el efecto de autoscroll lo llama en
  // cada render.
  Element.prototype.scrollIntoView = vi.fn()
})

describe('ChatWindow: estado de la conexion', () => {
  it.each([
    ['connecting', 'Conectando…'],
    ['connected', 'En línea'],
    ['reconnecting', 'Reconectando…'],
    ['disconnected', 'Sin conexión'],
    ['unauthorized', 'Sesión expirada'],
  ])('muestra el cartel de %s', (estado, etiqueta) => {
    renderWindow({ connectionStatus: estado as ChatConnectionStatus })

    expect(screen.getByText(etiqueta)).toBeInTheDocument()
  })

  // Sin sesion el socket ya no recibe nada: dejar el input habilitado haria
  // que el usuario escriba mensajes que no llegan a ningun lado.
  it('reemplaza el formulario por un link al login si la sesion expiro', () => {
    renderWindow({ connectionStatus: 'unauthorized' })

    expect(screen.queryByLabelText('Mensaje')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Iniciá sesión de nuevo' })).toHaveAttribute(
      'href',
      '/login'
    )
  })
})

describe('ChatWindow: historial', () => {
  it('muestra el spinner mientras carga', () => {
    renderWindow({ isLoading: true, messages: [] })

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
  })

  it('muestra el error de carga', () => {
    renderWindow({ loadError: 'No se pudo cargar el historial', messages: [] })

    expect(screen.getByText('No se pudo cargar el historial')).toBeInTheDocument()
  })

  it('invita a escribir cuando el chat esta vacio', () => {
    renderWindow({ messages: [] })

    expect(screen.getByText(/No hay mensajes todavía/)).toBeInTheDocument()
  })

  it('lista los mensajes distinguiendo los propios', () => {
    renderWindow({
      messages: [
        mensaje({ id: 1, senderId: 8, content: 'Hola' }),
        mensaje({ id: 2, senderId: USUARIO_ACTUAL, content: 'Hola! Contame' }),
      ],
    })

    expect(screen.getByText('Hola')).toBeInTheDocument()
    expect(screen.getByText('Hola! Contame')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})

describe('ChatWindow: envio de texto', () => {
  it('manda el mensaje y limpia el campo', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWindow({ onSend })

    await user.type(screen.getByLabelText('Mensaje'), 'Te paso mi teléfono')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ content: 'Te paso mi teléfono' }))
    expect(screen.getByLabelText('Mensaje')).toHaveValue('')
  })

  it('recorta los espacios antes de enviar', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWindow({ onSend })

    await user.type(screen.getByLabelText('Mensaje'), '  hola  ')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ content: 'hola' }))
  })

  it('deshabilita el boton mientras no haya texto util', async () => {
    const user = userEvent.setup()
    renderWindow()

    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()

    await user.type(screen.getByLabelText('Mensaje'), '   ')

    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  // Si el envio falla, el texto tiene que quedar en el campo para que el
  // usuario pueda reintentar sin volver a escribirlo.
  it('conserva el borrador cuando el envio falla', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('Chat cerrado'))
    const user = userEvent.setup()
    renderWindow({ onSend })

    await user.type(screen.getByLabelText('Mensaje'), 'no va a salir')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(onSend).toHaveBeenCalled())
    expect(screen.getByLabelText('Mensaje')).toHaveValue('no va a salir')
  })

  it('muestra el error de envio que le pasan desde arriba', () => {
    renderWindow({ sendError: 'No sos participante de este chat' })

    expect(screen.getByText('No sos participante de este chat')).toBeInTheDocument()
  })
})

describe('ChatWindow: envio de imagenes', () => {
  function archivo(nombre = 'foto.jpg', tipo = 'image/jpeg', bytes = 1000) {
    const file = new File(['x'], nombre, { type: tipo })
    Object.defineProperty(file, 'size', { value: bytes })
    return file
  }

  it('firma, sube y manda la url publica', async () => {
    vi.mocked(getPresignedUrl).mockResolvedValue({
      uploadUrl: 'https://r2/upload?firma=abc',
      publicUrl: 'https://cdn/foto.jpg',
      key: 'chats/foto.jpg',
    })
    vi.mocked(uploadToR2).mockResolvedValue(undefined)
    const onSend = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWindow({ onSend })

    await user.upload(screen.getByLabelText('Adjuntar imagen', { selector: 'input' }), archivo())

    await waitFor(() =>
      expect(getPresignedUrl).toHaveBeenCalledWith('foto.jpg', 'image/jpeg', 1000)
    )
    expect(uploadToR2).toHaveBeenCalledWith('https://r2/upload?firma=abc', expect.any(File))
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ imageUrl: 'https://cdn/foto.jpg' }))
  })

  // La validacion local evita gastar una firma en un archivo que el backend
  // iba a rechazar igual.
  it('rechaza un formato no permitido sin pedir firma', async () => {
    // userEvent filtra por el atributo accept del input; sin applyAccept:false
    // el gif nunca llega al handler y el guard del componente queda sin
    // ejercitar. La opcion es del setup, no del upload.
    const user = userEvent.setup({ applyAccept: false })
    renderWindow()

    await user.upload(
      screen.getByLabelText('Adjuntar imagen', { selector: 'input' }),
      archivo('animacion.gif', 'image/gif')
    )

    expect(await screen.findByText('Solo se permiten imágenes JPG, PNG o WebP')).toBeInTheDocument()
    expect(getPresignedUrl).not.toHaveBeenCalled()
  })

  it('rechaza una imagen que supera el tope de 10MB', async () => {
    const user = userEvent.setup()
    renderWindow()

    await user.upload(
      screen.getByLabelText('Adjuntar imagen', { selector: 'input' }),
      archivo('gigante.jpg', 'image/jpeg', 10_000_001)
    )

    expect(await screen.findByText('La imagen debe pesar menos de 10MB')).toBeInTheDocument()
    expect(getPresignedUrl).not.toHaveBeenCalled()
  })

  it('muestra el motivo cuando la subida falla', async () => {
    vi.mocked(getPresignedUrl).mockResolvedValue({
      uploadUrl: 'https://r2/upload?vencida',
      publicUrl: 'https://cdn/foto.jpg',
      key: 'chats/foto.jpg',
    })
    vi.mocked(uploadToR2).mockRejectedValue(new Error('No se pudo subir la imagen (HTTP 403)'))
    const user = userEvent.setup()
    renderWindow()

    await user.upload(screen.getByLabelText('Adjuntar imagen', { selector: 'input' }), archivo())

    expect(await screen.findByText('No se pudo subir la imagen (HTTP 403)')).toBeInTheDocument()
  })
})
