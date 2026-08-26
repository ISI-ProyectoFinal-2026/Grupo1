import type { MessageDTO } from '@/types/chat.types'

interface MessageBubbleProps {
  message: MessageDTO
  isOwn: boolean
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <li className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOwn ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm bg-gray-100 text-gray-900'
        }`}
      >
        <p className='whitespace-pre-wrap break-words text-sm'>{message.content ?? ''}</p>
        <time
          dateTime={message.createdAt}
          className={`mt-1 block text-right text-[11px] ${
            isOwn ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {formatTime(message.createdAt)}
        </time>
      </div>
    </li>
  )
}

export default MessageBubble
