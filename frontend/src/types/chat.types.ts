export interface ChatDTO {
  id: number
  userAId: number
  userBId: number
  reportId: number | null
  createdAt: string
}

export interface MessageDTO {
  id: number
  chatId: number
  senderId: number
  content: string | null
  createdAt: string
}

export interface CreateChatInput {
  reportId: number
  participantId: number
}

// respuesta de los ack del socket
export type SocketAck<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

export interface SocketErrorPayload {
  event: string
  message: string
}

export interface ServerToClientEvents {
  receive_message: (message: MessageDTO) => void
  error: (payload: SocketErrorPayload) => void
}

export interface ClientToServerEvents {
  join_chat: (payload: { chatId: number }, ack?: (response: SocketAck) => void) => void
  leave_chat: (payload: { chatId: number }, ack?: (response: SocketAck) => void) => void
  send_message: (
    payload: { chatId: number; content: string },
    ack?: (response: SocketAck<MessageDTO>) => void
  ) => void
}

export type ChatConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
