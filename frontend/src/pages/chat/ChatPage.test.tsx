import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { io } from 'socket.io-client'
import ChatPage from '@/pages/chat/ChatPage'
import * as chatsService from '@/services/chats.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AuthUser } from '@/types/auth'
import type { ChatDTO, MessageDTO } from '@/types/chat.types'

vi.mock('socket.io-client', () => ({ io: vi.fn() }))
vi.mock('@/services/chats.service')

const USUARIO_ACTUAL = 7

const usuario: AuthUser = {
  id: USUARIO_ACTUAL,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  role: 'usuario_regular',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

function chat(overrides: Partial<ChatDTO> = {}): ChatDTO {
  return {
    id: 3,
    userAId: USUARIO_ACTUAL,
    userBId: 8,
    reportId: 12,
    createdAt: '2026-09-22T10:00:00.000Z',
    ...overrides,
  }
}

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

function renderPage(ruta = '/chats') {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path='/chats' element={<ChatPage />} />
          <Route path='/chats/:id' element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // socket inerte: nunca conecta, asi que el envio cae al fallback REST
  vi.mocked(io).mockReturnValue({
    active: true,
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as ReturnType<typeof io>)
  // jsdom no implementa scrollIntoView
  Element.prototype.scrollIntoView = vi.fn()
  useAuthStore.setState({ token: 'token', user: usuario })
  vi.mocked(chatsService.listChats).mockResolvedValue([chat()])
  vi.mocked(chatsService.getMessages).mockResolvedValue([mensaje()])
})

afterEach(() => {
  useAuthStore.setState({ token: null, user: null })
})

describe('ChatPage: sin chat seleccionado', () => {
  it('lista las conversaciones e invita a elegir una', async () => {
    renderPage('/chats')

    expect(await screen.findByText('Usuario #8')).toBeInTheDocument()
    expect(screen.getByText('Elegí una conversación para ver los mensajes.')).toBeInTheDocument()
    expect(chatsService.getMessages).not.toHaveBeenCalled()
  })

  it('avisa cuando no hay conversaciones', async () => {
    vi.mocked(chatsService.listChats).mockResolvedValue([])

    renderPage('/chats')

    expect(await screen.findByText('No tenés conversaciones.')).toBeInTheDocument()
  })

  it('muestra el spinner mientras cargan las conversaciones', () => {
    vi.mocked(chatsService.listChats).mockReturnValue(new Promise(() => {}))

    renderPage('/chats')

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
  })

  it('muestra el error si fallan las conversaciones', async () => {
    vi.mocked(chatsService.listChats).mockRejectedValue(new Error('No se pudieron cargar los chats'))

    renderPage('/chats')

    expect(await screen.findByText('No se pudieron cargar los chats')).toBeInTheDocument()
  })

  it('no renderiza nada sin usuario autenticado', () => {
    useAuthStore.setState({ token: null, user: null })

    const { container } = renderPage('/chats')

    expect(container).toBeEmptyDOMElement()
  })
})

describe('ChatPage: chat seleccionado', () => {
  it('muestra la conversacion activa con sus mensajes', async () => {
    renderPage('/chats/3')

    expect(await screen.findByText('Hola, creo que vi a tu perro')).toBeInTheDocument()
    expect(chatsService.getMessages).toHaveBeenCalledWith(3)
    expect(screen.getByRole('link', { name: /Usuario #8/ })).toHaveAttribute('aria-current', 'page')
    expect(
      screen.queryByText('Elegí una conversación para ver los mensajes.')
    ).not.toBeInTheDocument()
  })

  it('muestra el error si falla el historial', async () => {
    vi.mocked(chatsService.getMessages).mockRejectedValue(new Error('No se pudo cargar el historial'))

    renderPage('/chats/3')

    expect(await screen.findByText('No se pudo cargar el historial')).toBeInTheDocument()
  })

  it.each(['abc', '0', '-2', '1.5'])('trata el id invalido "%s" como sin seleccion', async (id) => {
    renderPage(`/chats/${id}`)

    expect(await screen.findByText('Usuario #8')).toBeInTheDocument()
    expect(screen.getByText('Elegí una conversación para ver los mensajes.')).toBeInTheDocument()
    expect(chatsService.getMessages).not.toHaveBeenCalled()
  })

  it('envia un mensaje por REST cuando el socket no esta conectado', async () => {
    const user = userEvent.setup()
    const enviado = mensaje({ id: 2, senderId: USUARIO_ACTUAL, content: 'Voy para allá' })
    vi.mocked(chatsService.sendMessage).mockResolvedValue(enviado)
    renderPage('/chats/3')
    await screen.findByText('Hola, creo que vi a tu perro')

    await user.type(screen.getByLabelText('Mensaje'), 'Voy para allá')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() =>
      expect(chatsService.sendMessage).toHaveBeenCalledWith(3, { content: 'Voy para allá' })
    )
    const lista = await screen.findByText('Voy para allá')
    expect(within(lista.closest('ul') as HTMLElement).getAllByRole('listitem')).toHaveLength(2)
  })
})
