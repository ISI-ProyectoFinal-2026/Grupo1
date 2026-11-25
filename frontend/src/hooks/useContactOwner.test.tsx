import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as chatsService from '@/services/chats.service'
import { useContactOwner } from '@/hooks/useContactOwner'
import type { ChatDTO } from '@/types/chat.types'

vi.mock('@/services/chats.service')

function renderContact(onContacted = vi.fn()) {
  const { Wrapper } = createQueryWrapper()
  const hook = renderHook(() => useContactOwner(5, onContacted), { wrapper: Wrapper })
  return { ...hook, onContacted }
}

describe('useContactOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('abre el chat del reporte con el autor y entrega su id', async () => {
    vi.mocked(chatsService.createChat).mockResolvedValue({ id: 42 } as ChatDTO)
    const { result, onContacted } = renderContact()

    act(() => result.current.contact(7))

    await waitFor(() => expect(onContacted).toHaveBeenCalledWith(42))
    expect(chatsService.createChat).toHaveBeenCalledWith({ reportId: 5, participantId: 7 })
    expect(result.current.error).toBeNull()
  })

  it('queda en curso mientras se crea el chat', async () => {
    vi.mocked(chatsService.createChat).mockReturnValue(new Promise(() => {}))
    const { result } = renderContact()

    act(() => result.current.contact(7))

    await waitFor(() => expect(result.current.isPending).toBe(true))
  })

  it('si falla expone el error y no abre ningún chat', async () => {
    const failure = new Error('Request failed with status code 500')
    vi.mocked(chatsService.createChat).mockRejectedValue(failure)
    const { result, onContacted } = renderContact()

    act(() => result.current.contact(7))

    await waitFor(() => expect(result.current.error).toBe(failure))
    expect(onContacted).not.toHaveBeenCalled()
  })
})
