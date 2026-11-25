import { useMutation } from '@tanstack/react-query'
import { createChat } from '@/services/chats.service'

// POST /api/chats es idempotente por reporte: si el chat ya existe responde ese
// mismo, así que no hay fallback y cualquier error se muestra.
export function useContactOwner(reportId: number, onContacted: (chatId: number) => void) {
  const mutation = useMutation({
    mutationFn: async (ownerId: number) => {
      const chat = await createChat({ reportId, participantId: ownerId })
      return chat.id
    },
    onSuccess: (chatId) => onContacted(chatId),
  })

  return {
    contact: (ownerId: number) => mutation.mutate(ownerId),
    isPending: mutation.isPending,
    error: mutation.error,
  }
}
