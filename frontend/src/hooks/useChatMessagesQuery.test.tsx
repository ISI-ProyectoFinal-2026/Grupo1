import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendMessage,
  chatMessagesQueryKey,
  flattenMessages,
  useChatMessagesQuery,
  type ChatMessagesData,
} from '@/hooks/useChatMessagesQuery'
import { getMessages } from '@/services/chats.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { MessageDTO } from '@/types/chat.types'

vi.mock('@/services/chats.service', () => ({
  getMessages: vi.fn(),
}))

function mensaje(id: number): MessageDTO {
  return {
    id,
    chatId: 3,
    senderId: 7,
    content: `mensaje ${id}`,
    imageUrl: null,
    createdAt: '2026-09-22T10:05:00.000Z',
  }
}

describe('useChatMessagesQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trae los ultimos mensajes del chat abierto', async () => {
    vi.mocked(getMessages).mockResolvedValue({ items: [mensaje(1)], nextCursor: null })
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useChatMessagesQuery(3), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getMessages).toHaveBeenCalledWith(3, undefined)
    expect(result.current.data).toEqual([mensaje(1)])
    expect(result.current.hasNextPage).toBe(false)
  })

  // #338: los anteriores se anteponen y el historial queda ascendente
  it('carga los anteriores con el cursor y los antepone', async () => {
    vi.mocked(getMessages)
      .mockResolvedValueOnce({ items: [mensaje(3), mensaje(4)], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [mensaje(1), mensaje(2)], nextCursor: null })
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useChatMessagesQuery(3), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))

    await result.current.fetchNextPage()

    await waitFor(() => expect(result.current.data?.map((m) => m.id)).toEqual([1, 2, 3, 4]))
    expect(getMessages).toHaveBeenLastCalledWith(3, 'c1')
    expect(result.current.hasNextPage).toBe(false)
  })

  // Sin chat abierto la query queda en pausa: el queryFn hace un non-null
  // assertion sobre chatId y explotaria con undefined.
  it('no consulta mientras no haya chat abierto', () => {
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useChatMessagesQuery(undefined), { wrapper: Wrapper })

    expect(getMessages).not.toHaveBeenCalled()
  })

  it('separa la cache por chat en la query key', () => {
    expect(chatMessagesQueryKey(3)).toEqual(['chat-messages', 3])
    expect(chatMessagesQueryKey(4)).not.toEqual(chatMessagesQueryKey(3))
  })
})

describe('appendMessage', () => {
  const cargado: ChatMessagesData = {
    pages: [
      { items: [mensaje(3), mensaje(4)], nextCursor: 'c1' },
      { items: [mensaje(1), mensaje(2)], nextCursor: null },
    ],
    pageParams: [undefined, 'c1'],
  }

  it('agrega al final de la pagina mas reciente', () => {
    const resultado = appendMessage(cargado, mensaje(5))

    expect(flattenMessages(resultado!).map((m) => m.id)).toEqual([1, 2, 3, 4, 5])
    expect(resultado!.pageParams).toEqual(cargado.pageParams)
  })

  it('ignora un mensaje que ya esta en cualquier pagina', () => {
    expect(appendMessage(cargado, mensaje(1))).toBe(cargado)
  })

  it('no crea cache si el historial no se cargo', () => {
    expect(appendMessage(undefined, mensaje(1))).toBeUndefined()
  })
})
