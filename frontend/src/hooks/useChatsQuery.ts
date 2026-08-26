import { useQuery } from '@tanstack/react-query'
import { listChats } from '@/services/chats.service'

export const chatsQueryKey = ['chats'] as const

export function useChatsQuery(enabled = true) {
  return useQuery({
    queryKey: chatsQueryKey,
    queryFn: listChats,
    enabled,
  })
}
