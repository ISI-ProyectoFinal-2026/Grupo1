import { useParams } from 'react-router-dom'
import ChatList from '@/components/chat/ChatList'
import ChatWindow from '@/components/chat/ChatWindow'
import { useChatMessagesQuery } from '@/hooks/useChatMessagesQuery'
import { useChatSocket } from '@/hooks/useChatSocket'
import { useChatsQuery } from '@/hooks/useChatsQuery'
import { useAuthStore } from '@/stores/auth.store'

function toErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null
}

function parseChatId(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const chatId = parseChatId(id)
  const currentUserId = useAuthStore((state) => state.user?.id)

  const chatsQuery = useChatsQuery()
  const messagesQuery = useChatMessagesQuery(chatId)
  const { status, error: socketError, sendMessage } = useChatSocket(chatId)

  async function handleSend(content: string) {
    await sendMessage(content)
  }

  if (!currentUserId) return null

  return (
    <div className='mx-auto flex h-[calc(100vh-4rem)] max-w-5xl gap-4 p-4'>
      <aside
        className={`w-full overflow-y-auto rounded-lg border border-gray-200 bg-white md:w-72 md:shrink-0 ${
          chatId ? 'hidden md:block' : ''
        }`}
      >
        <h1 className='border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900'>
          Conversaciones
        </h1>
        <ChatList
          chats={chatsQuery.data ?? []}
          currentUserId={currentUserId}
          activeChatId={chatId}
          isLoading={chatsQuery.isPending}
          error={toErrorMessage(chatsQuery.error)}
        />
      </aside>

      <main
        className={`flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white ${
          chatId ? '' : 'hidden md:block'
        }`}
      >
        {chatId ? (
          <ChatWindow
            messages={messagesQuery.data ?? []}
            currentUserId={currentUserId}
            connectionStatus={status}
            isLoading={messagesQuery.isPending}
            loadError={toErrorMessage(messagesQuery.error)}
            sendError={socketError}
            onSend={handleSend}
          />
        ) : (
          <p className='flex h-full items-center justify-center px-4 text-center text-sm text-gray-500'>
            Elegí una conversación para ver los mensajes.
          </p>
        )}
      </main>
    </div>
  )
}

export default ChatPage
