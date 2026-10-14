import { Link } from 'react-router-dom'
import ErrorMessage from '@/components/ui/ErrorMessage'
import Spinner from '@/components/ui/Spinner'
import { UserIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
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
      <div className='flex justify-center py-8 text-ink-muted'>
        <Spinner size='md' />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} className='px-4 py-3' />
  }

  if (chats.length === 0) {
    return <p className='px-4 py-10 text-center text-ink-muted'>No tenés conversaciones.</p>
  }

  return (
    <ul className='divide-y divide-line'>
      {chats.map((chat) => {
        const participantId = chat.userAId === currentUserId ? chat.userBId : chat.userAId
        const isActive = chat.id === activeChatId

        return (
          <li key={chat.id}>
            <Link
              to={`/chats/${chat.id}`}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface',
                isActive &&
                  'bg-surface before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-signal'
              )}
            >
              <span className='grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-ink-muted ring-1 ring-line'>
                <UserIcon className='h-5 w-5' />
              </span>
              <div className='min-w-0 flex-1'>
                <p className='truncate font-bold text-ink'>Usuario #{participantId}</p>
                <p className='truncate text-sm text-ink-muted'>
                  {chat.reportId ? `Reporte #${chat.reportId}` : 'Sin reporte asociado'}
                </p>
              </div>
              <time dateTime={chat.createdAt} className='shrink-0 self-start text-sm text-ink-muted'>
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
