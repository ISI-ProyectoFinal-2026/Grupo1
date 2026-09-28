import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatMessagesQueryKey, useChatMessagesQuery } from '@/hooks/useChatMessagesQuery'
import { getMessages } from '@/services/chats.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { MessageDTO } from '@/types/chat.types'

vi.mock('@/services/chats.service', () => ({
  getMessages: vi.fn(),
}))

const mensajes: MessageDTO[] = [
  {
    id: 1,
    chatId: 3,
    senderId: 7,
    content: 'Hola, creo que vi a tu perro',
    imageUrl: null,
    createdAt: '2026-09-22T10:05:00.000Z',
  },
]

describe('useChatMessagesQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trae el historial del chat abierto', async () => {
    vi.mocked(getMessages).mockResolvedValue(mensajes)
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useChatMessagesQuery(3), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getMessages).toHaveBeenCalledWith(3)
    expect(result.current.data).toEqual(mensajes)
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
