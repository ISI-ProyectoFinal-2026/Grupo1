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
