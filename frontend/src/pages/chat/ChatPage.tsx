import { Link, useParams } from 'react-router-dom'
import ChatList from '@/components/chat/ChatList'
import ChatWindow from '@/components/chat/ChatWindow'
import { useChatMessagesQuery } from '@/hooks/useChatMessagesQuery'
import { useChatSocket } from '@/hooks/useChatSocket'
import { useChatsQuery } from '@/hooks/useChatsQuery'
import { useAuthStore } from '@/stores/auth.store'
import type { SendMessageInput } from '@/types/chat.types'
import { ChatIcon, ChevronLeftIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

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
  const { status, error: socketError, errorCode: socketErrorCode, sendMessage } = useChatSocket(chatId)

  async function handleSend(input: SendMessageInput) {
    await sendMessage(input)
  }

  if (!currentUserId) return null

  const activeChat = chatsQuery.data?.find((chat) => chat.id === chatId)
  const participantId = activeChat
    ? activeChat.userAId === currentUserId
      ? activeChat.userBId
      : activeChat.userAId
    : undefined

  return (
    // Alto fijo a la pantalla: la lista y la conversacion scrollean por dentro,
    // y el composer queda siempre a mano sobre la tab bar.
    <div className='mx-auto flex h-app max-w-6xl md:gap-4 md:p-4 lg:h-dvh lg:p-6'>
      <aside
        className={cn(
          'w-full overflow-y-auto bg-paper md:card md:w-80 md:shrink-0',
          chatId ? 'hidden md:block' : ''
        )}
      >
        <h1 className='sticky top-0 z-10 border-b border-line bg-paper px-4 py-3 font-display text-display-md'>
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

      <section
        aria-label='Conversación'
        className={cn(
          'min-w-0 flex-1 overflow-hidden bg-paper md:card',
          chatId ? 'flex flex-col' : 'hidden md:flex md:flex-col'
        )}
      >
        {chatId ? (
          <ChatWindow
            messages={messagesQuery.data ?? []}
            currentUserId={currentUserId}
            connectionStatus={status}
            isLoading={messagesQuery.isPending}
            loadError={toErrorMessage(messagesQuery.error)}
            sendError={socketError}
            sendErrorCode={socketErrorCode}
            onSend={handleSend}
            title={participantId !== undefined ? `Usuario #${participantId}` : undefined}
            headerStart={
              <Link
                to='/chats'
                aria-label='Volver a conversaciones'
                className='grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5 md:hidden'
              >
                <ChevronLeftIcon className='h-6 w-6' />
              </Link>
            }
          />
        ) : (
          <div className='flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-ink-muted'>
            <ChatIcon className='h-10 w-10' strokeWidth={1.5} />
            <p>Elegí una conversación para ver los mensajes.</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default ChatPage
