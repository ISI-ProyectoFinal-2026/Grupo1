import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { io } from 'socket.io-client'
import { chatMessagesQueryKey } from '@/hooks/useChatMessagesQuery'
import { chatsQueryKey } from '@/hooks/useChatsQuery'
import { useChatSocket } from '@/hooks/useChatSocket'
import { sendMessage as sendMessageRest } from '@/services/chats.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper, createTestQueryClient } from '@/test/query-wrapper'
import type { MessageDTO } from '@/types/chat.types'

vi.mock('socket.io-client', () => ({ io: vi.fn() }))
vi.mock('@/services/chats.service', () => ({ sendMessage: vi.fn() }))

type Handler = (...args: never[]) => void

// Doble del socket: guarda los handlers que registra el hook para poder
// dispararlos a mano y simular conexion, caidas y mensajes entrantes.
function crearSocketFalso() {
  const handlers = new Map<string, Set<Handler>>()

  const socket = {
    active: true,
    connected: false,
    on: vi.fn((evento: string, handler: Handler) => {
      const registrados = handlers.get(evento) ?? new Set<Handler>()
      registrados.add(handler)
      handlers.set(evento, registrados)
    }),
    off: vi.fn((evento: string, handler: Handler) => {
      handlers.get(evento)?.delete(handler)
    }),
    emit: vi.fn(),
    disconnect: vi.fn(() => {
      socket.connected = false
    }),
  }

  function disparar(evento: string, ...args: unknown[]) {
    act(() => {
      handlers.get(evento)?.forEach((handler) => (handler as (...a: unknown[]) => void)(...args))
    })
  }

  function conectar() {
    socket.connected = true
    disparar('connect')
  }

  return { socket, disparar, conectar }
}

const usuario = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
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

let falso: ReturnType<typeof crearSocketFalso>

function montar(chatId: number | undefined) {
  const client = createTestQueryClient()
  const { Wrapper } = createQueryWrapper(client)
  const vista = renderHook(({ id }: { id: number | undefined }) => useChatSocket(id), {
    wrapper: Wrapper,
    initialProps: { id: chatId },
  })
  return { ...vista, client }
}

beforeEach(() => {
  vi.clearAllMocks()
  falso = crearSocketFalso()
  vi.mocked(io).mockReturnValue(falso.socket as unknown as ReturnType<typeof io>)
  useAuthStore.getState().setAuth('jwt-de-prueba', usuario)
})

afterEach(() => {
  useAuthStore.getState().logout()
})

describe('useChatSocket: ciclo de conexion', () => {
  it('no abre socket sin sesion y se reporta desconectado', () => {
    useAuthStore.getState().logout()

    const { result } = montar(3)

    expect(io).not.toHaveBeenCalled()
    expect(result.current.status).toBe('disconnected')
  })

  it('abre el socket mandando el token en el handshake', () => {
    montar(3)

    expect(io).toHaveBeenCalledWith(
      '',
      expect.objectContaining({ auth: { token: 'jwt-de-prueba' } })
    )
  })

  it('arranca en connecting y pasa a connected', () => {
    const { result } = montar(3)

    expect(result.current.status).toBe('connecting')

    falso.conectar()

    expect(result.current.status).toBe('connected')
  })

  it('cierra el socket al desmontar', () => {
    const { unmount } = montar(3)

    unmount()

    expect(falso.socket.disconnect).toHaveBeenCalled()
  })
})

describe('useChatSocket: caidas y reconexion', () => {
  it('marca reconnecting ante una caida recuperable', () => {
    const { result } = montar(3)
    falso.conectar()

    falso.disparar('disconnect', 'transport close')

    expect(result.current.status).toBe('reconnecting')
  })

  it.each(['io client disconnect', 'io server disconnect'])(
    'marca disconnected cuando la baja es final (%s)',
    (motivo) => {
      const { result } = montar(3)
      falso.conectar()

      falso.disparar('disconnect', motivo)

      expect(result.current.status).toBe('disconnected')
    }
  )

  // Cuando el rechazo viene del middleware de auth del server, socket.io-client
  // destruye sus subscripciones y no reintenta nunca mas, por mas que
  // reconnectionAttempts sea Infinity. `active` en false distingue ese caso
  // terminal de una caida de red: sin esto el usuario miraba "Reconectando..."
  // para siempre, sin nada reconectando.
  it('marca unauthorized cuando el server rechaza el handshake', () => {
    const { result } = montar(3)
    falso.socket.active = false

    falso.disparar('connect_error', new Error('Token inválido'))

    expect(result.current.status).toBe('unauthorized')
    expect(result.current.error).toBe('Token inválido')
  })

  it('marca reconnecting cuando el error de conexion si es recuperable', () => {
    const { result } = montar(3)
    falso.socket.active = true

    falso.disparar('connect_error', new Error('websocket error'))

    expect(result.current.status).toBe('reconnecting')
    expect(result.current.error).toBe('websocket error')
  })

  it('no refresca nada en la primera conexion', () => {
    const { client } = montar(3)
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    falso.conectar()

    expect(invalidate).not.toHaveBeenCalled()
  })

  // Tras una caida el historial local pudo quedar desfasado: al volver hay que
  // revalidar el chat abierto y el listado.
  it('refresca historial y listado al reconectar', () => {
    const { client } = montar(3)
    falso.conectar()
    falso.disparar('disconnect', 'transport close')
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    falso.conectar()

    expect(invalidate).toHaveBeenCalledWith({ queryKey: chatMessagesQueryKey(3) })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: chatsQueryKey })
  })
})

describe('useChatSocket: sala del chat', () => {
  it('entra a la sala al conectarse', () => {
    montar(3)

    falso.conectar()

    expect(falso.socket.emit).toHaveBeenCalledWith(
      'join_chat',
      { chatId: 3 },
      expect.any(Function)
    )
  })

  it('no entra a ninguna sala si no hay chat abierto', () => {
    montar(undefined)

    falso.conectar()

    expect(falso.socket.emit).not.toHaveBeenCalled()
  })

  it('expone el error cuando el server rechaza el join', () => {
    const { result } = montar(3)
    falso.conectar()
    const [, , ack] = falso.socket.emit.mock.calls[0] as [string, unknown, (r: unknown) => void]

    act(() => ack({ ok: false, error: 'No sos participante de este chat' }))

    expect(result.current.error).toBe('No sos participante de este chat')
  })

  it('sale de la sala anterior al cambiar de chat', () => {
    const { rerender } = montar(3)
    falso.conectar()

    rerender({ id: 4 })

    expect(falso.socket.emit).toHaveBeenCalledWith('leave_chat', { chatId: 3 })
    expect(falso.socket.emit).toHaveBeenCalledWith(
      'join_chat',
      { chatId: 4 },
      expect.any(Function)
    )
  })
})

describe('useChatSocket: mensajes entrantes', () => {
  it('agrega el mensaje recibido al historial en cache', () => {
    const { client } = montar(3)
    falso.conectar()

    falso.disparar('receive_message', mensaje())

    expect(client.getQueryData(chatMessagesQueryKey(3))).toEqual([mensaje()])
  })

  // El mismo mensaje puede llegar dos veces (eco del propio envio + broadcast).
  it('ignora un mensaje repetido por id', () => {
    const { client } = montar(3)
    falso.conectar()

    falso.disparar('receive_message', mensaje())
    falso.disparar('receive_message', mensaje())

    expect(client.getQueryData<MessageDTO[]>(chatMessagesQueryKey(3))).toHaveLength(1)
  })

  it('expone los errores que emite el server', () => {
    const { result } = montar(3)
    falso.conectar()

    falso.disparar('error', { event: 'send_message', message: 'Mensaje vacío' })

    expect(result.current.error).toBe('Mensaje vacío')
  })
})

describe('useChatSocket: envio de mensajes', () => {
  it('falla si no hay chat seleccionado', async () => {
    const { result } = montar(undefined)

    await expect(result.current.sendMessage({ content: 'hola' })).rejects.toThrow(
      'No hay un chat seleccionado'
    )
  })

  // Sin socket el mensaje igual se persiste: el REST es el fallback real, no
  // un camino muerto.
  it('cae al POST REST cuando el socket no esta conectado', async () => {
    const enviado = mensaje({ id: 9, senderId: 7, content: 'hola' })
    vi.mocked(sendMessageRest).mockResolvedValue(enviado)
    const { result, client } = montar(3)

    await act(async () => {
      await result.current.sendMessage({ content: 'hola' })
    })

    expect(sendMessageRest).toHaveBeenCalledWith(3, { content: 'hola' })
    expect(client.getQueryData(chatMessagesQueryKey(3))).toEqual([enviado])
  })

  it('emite por socket y guarda la respuesta del ack', async () => {
    const enviado = mensaje({ id: 9, senderId: 7, content: 'hola' })
    const { result, client } = montar(3)
    falso.conectar()
    falso.socket.emit.mockImplementation(
      (evento: string, _payload: unknown, ack?: (r: unknown) => void) => {
        if (evento === 'send_message') ack?.({ ok: true, data: enviado })
      }
    )

    await act(async () => {
      await result.current.sendMessage({ content: 'hola' })
    })

    expect(sendMessageRest).not.toHaveBeenCalled()
    expect(client.getQueryData(chatMessagesQueryKey(3))).toEqual([enviado])
  })

  it('rechaza y expone el error cuando el ack viene en falla', async () => {
    const { result } = montar(3)
    falso.conectar()
    falso.socket.emit.mockImplementation(
      (evento: string, _payload: unknown, ack?: (r: unknown) => void) => {
        if (evento === 'send_message') ack?.({ ok: false, error: 'Chat cerrado' })
      }
    )

    await expect(result.current.sendMessage({ content: 'hola' })).rejects.toThrow('Chat cerrado')
    await waitFor(() => expect(result.current.error).toBe('Chat cerrado'))
  })
})
