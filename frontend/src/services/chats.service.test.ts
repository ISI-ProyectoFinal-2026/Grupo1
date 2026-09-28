import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import { createChat, getMessages, listChats, sendMessage } from '@/services/chats.service'
import type { ChatDTO, MessageDTO } from '@/types/chat.types'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

function chat(overrides: Partial<ChatDTO> = {}): ChatDTO {
  return {
    id: 3,
    userAId: 7,
    userBId: 8,
    reportId: 5,
    createdAt: '2026-09-22T10:00:00.000Z',
    ...overrides,
  }
}

function mensaje(overrides: Partial<MessageDTO> = {}): MessageDTO {
  return {
    id: 1,
    chatId: 3,
    senderId: 7,
    content: 'Hola, creo que vi a tu perro',
    imageUrl: null,
    createdAt: '2026-09-22T10:05:00.000Z',
    ...overrides,
  }
}

describe('chats.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista los chats propios desde GET /chats', async () => {
    const listado = [chat()]
    vi.mocked(api.get).mockResolvedValue(respuesta(listado))

    const resultado = await listChats()

    expect(api.get).toHaveBeenCalledWith('/chats')
    expect(resultado).toEqual(listado)
  })

  it('crea el chat contra POST /chats con reporte y participante', async () => {
    const creado = chat()
    vi.mocked(api.post).mockResolvedValue(respuesta(creado))

    const resultado = await createChat({ reportId: 5, participantId: 8 })

    expect(api.post).toHaveBeenCalledWith('/chats', { reportId: 5, participantId: 8 })
    expect(resultado).toEqual(creado)
  })

  it('trae el historial desde GET /chats/:id/messages', async () => {
    const historial = [mensaje()]
    vi.mocked(api.get).mockResolvedValue(respuesta(historial))

    const resultado = await getMessages(3)

    expect(api.get).toHaveBeenCalledWith('/chats/3/messages')
    expect(resultado).toEqual(historial)
  })

  // Este POST es el fallback REST: se usa cuando el socket no esta conectado,
  // asi que tiene que funcionar de forma independiente del canal de tiempo real.
  it('envia por REST contra POST /chats/:id/messages', async () => {
    const enviado = mensaje({ content: 'Te paso mi telefono' })
    vi.mocked(api.post).mockResolvedValue(respuesta(enviado))

    const resultado = await sendMessage(3, { content: 'Te paso mi telefono' })

    expect(api.post).toHaveBeenCalledWith('/chats/3/messages', { content: 'Te paso mi telefono' })
    expect(resultado).toEqual(enviado)
  })

  it('acepta un mensaje solo con imagen', async () => {
    const conImagen = mensaje({ content: null, imageUrl: 'https://cdn/foto.jpg' })
    vi.mocked(api.post).mockResolvedValue(respuesta(conImagen))

    const resultado = await sendMessage(3, { imageUrl: 'https://cdn/foto.jpg' })

    expect(api.post).toHaveBeenCalledWith('/chats/3/messages', {
      imageUrl: 'https://cdn/foto.jpg',
    })
    expect(resultado.imageUrl).toBe('https://cdn/foto.jpg')
  })
})
