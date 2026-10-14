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
        className={`max-w-[80%] rounded-[18px] px-3.5 py-2 sm:max-w-[70%] ${
          isOwn ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md border border-line bg-paper text-ink'
        }`}
      >
        {message.imageUrl && (
          <a href={message.imageUrl} target='_blank' rel='noreferrer' className='block'>
            <img
              src={message.imageUrl}
              alt='Imagen enviada en el chat'
              loading='lazy'
              className='mb-1 max-h-60 max-w-full rounded-control object-cover'
            />
          </a>
        )}
        {message.content && <p className='whitespace-pre-wrap break-words'>{message.content}</p>}
        <time
          dateTime={message.createdAt}
          className={`mt-0.5 block text-right text-xs ${isOwn ? 'text-white/75' : 'text-ink-muted'}`}
        >
          {formatTime(message.createdAt)}
        </time>
      </div>
    </li>
  )
}

export default MessageBubble
