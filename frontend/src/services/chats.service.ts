import { api } from './api'
import type { ChatDTO, CreateChatInput, MessageDTO, SendMessageInput } from '@/types/chat.types'
import type { CursorPage } from '@/types/pagination.types'

export async function listChats(): Promise<ChatDTO[]> {
  const { data } = await api.get<ChatDTO[]>('/chats')
  return data
}

export async function createChat(input: CreateChatInput): Promise<ChatDTO> {
  const { data } = await api.post<ChatDTO>('/chats', input)
  return data
}

// últimos mensajes en orden ascendente; el cursor trae los anteriores (#338)
export async function getMessages(chatId: number, cursor?: string): Promise<CursorPage<MessageDTO>> {
  const { data } = await api.get<CursorPage<MessageDTO>>(`/chats/${chatId}/messages`, {
    params: cursor ? { cursor } : undefined,
  })
  return data
}

// fallback REST cuando el socket no está conectado
export async function sendMessage(chatId: number, input: SendMessageInput): Promise<MessageDTO> {
  const { data } = await api.post<MessageDTO>(`/chats/${chatId}/messages`, input)
  return data
}
