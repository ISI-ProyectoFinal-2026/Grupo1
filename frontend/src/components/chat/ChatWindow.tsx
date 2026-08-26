import { useEffect, useRef, useState, type FormEvent } from 'react'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'
import Spinner from '@/components/ui/Spinner'
import MessageBubble from './MessageBubble'
import type { ChatConnectionStatus, MessageDTO } from '@/types/chat.types'

interface ChatWindowProps {
  messages: MessageDTO[]
  currentUserId: number
  connectionStatus: ChatConnectionStatus
  isLoading: boolean
  loadError: string | null
  sendError: string | null
  onSend: (content: string) => Promise<void>
}

const statusLabels: Record<ChatConnectionStatus, string> = {
  connecting: 'Conectando…',
  connected: 'En línea',
  reconnecting: 'Reconectando…',
  disconnected: 'Sin conexión',
}

const statusDotClasses: Record<ChatConnectionStatus, string> = {
  connecting: 'bg-amber-500',
  connected: 'bg-green-500',
  reconnecting: 'bg-amber-500',
  disconnected: 'bg-gray-400',
}

function ChatWindow({
  messages,
  currentUserId,
  connectionStatus,
  isLoading,
  loadError,
  sendError,
  onSend,
}: ChatWindowProps) {
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || isSending) return

    setIsSending(true)
    try {
      await onSend(content)
      setDraft('')
    } catch {
      // el error ya se muestra desde sendError
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className='flex h-full flex-col'>
      <header className='flex items-center gap-2 border-b border-gray-200 px-4 py-3'>
        <span
          aria-hidden='true'
          className={`h-2 w-2 rounded-full ${statusDotClasses[connectionStatus]}`}
        />
        <span className='text-sm text-gray-600'>{statusLabels[connectionStatus]}</span>
      </header>

      <div className='flex-1 overflow-y-auto px-4 py-4'>
        {isLoading ? (
          <div className='flex h-full items-center justify-center text-gray-400'>
            <Spinner size='md' />
          </div>
        ) : loadError ? (
          <ErrorMessage message={loadError} />
        ) : messages.length === 0 ? (
          <p className='py-8 text-center text-sm text-gray-500'>
            No hay mensajes todavía. Escribí el primero.
          </p>
        ) : (
          <ul className='flex flex-col gap-2'>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.senderId === currentUserId}
              />
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className='border-t border-gray-200 px-4 py-3'>
        {sendError && <ErrorMessage message={sendError} className='mb-2' />}
        <div className='flex items-center gap-2'>
          <label htmlFor='chat-message-input' className='sr-only'>
            Mensaje
          </label>
          <input
            id='chat-message-input'
            type='text'
            autoComplete='off'
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder='Escribí un mensaje…'
            className='flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none'
          />
          <Button type='submit' variant='primary' isLoading={isSending} disabled={!draft.trim()}>
            Enviar
          </Button>
        </div>
      </form>
    </section>
  )
}

export default ChatWindow
