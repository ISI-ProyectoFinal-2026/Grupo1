import { useQuery } from '@tanstack/react-query'
import { getMessages } from '@/services/chats.service'

export function chatMessagesQueryKey(chatId: number | undefined) {
  return ['chat-messages', chatId] as const
}

export function useChatMessagesQuery(chatId: number | undefined) {
  return useQuery({
    queryKey: chatMessagesQueryKey(chatId),
    queryFn: () => getMessages(chatId!),
    enabled: !!chatId,
  })
}
