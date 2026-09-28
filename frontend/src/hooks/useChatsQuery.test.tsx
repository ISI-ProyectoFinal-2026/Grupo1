import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatsQueryKey, useChatsQuery } from '@/hooks/useChatsQuery'
import { listChats } from '@/services/chats.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { ChatDTO } from '@/types/chat.types'

vi.mock('@/services/chats.service', () => ({
  listChats: vi.fn(),
}))

const chats: ChatDTO[] = [
  { id: 3, userAId: 7, userBId: 8, reportId: 5, createdAt: '2026-09-22T10:00:00.000Z' },
]

describe('useChatsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('expone la lista de chats del usuario', async () => {
    vi.mocked(listChats).mockResolvedValue(chats)
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useChatsQuery(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(chats)
  })

  // El listado se monta en pantallas donde puede no haber sesion todavia; con
  // enabled en false no debe salir a pedir nada.
  it('no consulta cuando esta deshabilitado', () => {
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useChatsQuery(false), { wrapper: Wrapper })

    expect(listChats).not.toHaveBeenCalled()
  })

  it('usa una key estable para poder invalidarla desde afuera', () => {
    expect(chatsQueryKey).toEqual(['chats'])
  })
})
