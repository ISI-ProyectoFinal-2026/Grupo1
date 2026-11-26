import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import { getMessages } from '@/services/chats.service'
import type { MessageDTO } from '@/types/chat.types'
import type { CursorPage } from '@/types/pagination.types'

// pages[0] es la más reciente; cada página viene en orden ascendente (#338)
export type ChatMessagesData = InfiniteData<CursorPage<MessageDTO>, string | undefined>

export function chatMessagesQueryKey(chatId: number | undefined) {
  return ['chat-messages', chatId] as const
}

export function flattenMessages(data: ChatMessagesData): MessageDTO[] {
  return [...data.pages].reverse().flatMap((page) => page.items)
}

// agrega al final de la página más reciente, sin duplicar
export function appendMessage(
  data: ChatMessagesData | undefined,
  message: MessageDTO
): ChatMessagesData | undefined {
  const [latest, ...older] = data?.pages ?? []
  if (!data || !latest) return data
  if (data.pages.some((page) => page.items.some((item) => item.id === message.id))) return data
  return { ...data, pages: [{ ...latest, items: [...latest.items, message] }, ...older] }
}

export function useChatMessagesQuery(chatId: number | undefined) {
  return useInfiniteQuery({
    queryKey: chatMessagesQueryKey(chatId),
    queryFn: ({ pageParam }) => getMessages(chatId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: flattenMessages,
    enabled: !!chatId,
  })
}
