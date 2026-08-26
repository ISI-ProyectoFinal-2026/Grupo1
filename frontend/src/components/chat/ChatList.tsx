import { Link } from 'react-router-dom'
import ErrorMessage from '@/components/ui/ErrorMessage'
import Spinner from '@/components/ui/Spinner'
import type { ChatDTO } from '@/types/chat.types'

interface ChatListProps {
  chats: ChatDTO[]
  currentUserId: number
  activeChatId: number | undefined
  isLoading: boolean
  error: string | null
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })
}

function ChatList({ chats, currentUserId, activeChatId, isLoading, error }: ChatListProps) {
  if (isLoading) {
    return (
      <div className='flex justify-center py-8 text-gray-400'>
        <Spinner size='md' />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} className='px-4 py-3' />
  }

  if (chats.length === 0) {
    return <p className='px-4 py-8 text-center text-sm text-gray-500'>No tenés conversaciones.</p>
  }

  return (
    <ul className='divide-y divide-gray-100'>
      {chats.map((chat) => {
        const participantId = chat.userAId === currentUserId ? chat.userBId : chat.userAId
        const isActive = chat.id === activeChatId

        return (
          <li key={chat.id}>
            <Link
              to={`/chats/${chat.id}`}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-gray-50 ${
                isActive ? 'bg-blue-50' : ''
              }`}
            >
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium text-gray-900'>
                  Usuario #{participantId}
                </p>
                <p className='truncate text-xs text-gray-500'>
                  {chat.reportId ? `Reporte #${chat.reportId}` : 'Sin reporte asociado'}
                </p>
              </div>
              <time dateTime={chat.createdAt} className='shrink-0 text-xs text-gray-400'>
                {formatDate(chat.createdAt)}
              </time>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export default ChatList
