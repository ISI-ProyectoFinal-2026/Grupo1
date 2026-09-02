import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'
import Spinner from '@/components/ui/Spinner'
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  getPresignedUrl,
  uploadToR2,
  type UploadContentType,
} from '@/services/uploads.service'
import MessageBubble from './MessageBubble'
import type { ChatConnectionStatus, MessageDTO, SendMessageInput } from '@/types/chat.types'

interface ChatWindowProps {
  messages: MessageDTO[]
  currentUserId: number
  connectionStatus: ChatConnectionStatus
  isLoading: boolean
  loadError: string | null
  sendError: string | null
  onSend: (input: SendMessageInput) => Promise<void>
}

const MAX_UPLOAD_MB = Math.floor(MAX_UPLOAD_BYTES / 1_000_000)

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
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || isSending) return

    setIsSending(true)
    try {
      await onSend({ content })
      setDraft('')
    } catch {
      // el error ya se muestra desde sendError
    } finally {
      setIsSending(false)
    }
  }

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    setImageError(null)

    if (!ALLOWED_UPLOAD_TYPES.includes(file.type as UploadContentType)) {
      setImageError('Solo se permiten imágenes JPG, PNG o WebP')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setImageError(`La imagen debe pesar menos de ${MAX_UPLOAD_MB}MB`)
      return
    }

    setIsUploadingImage(true)
    try {
      const presign = await getPresignedUrl(file.name, file.type as UploadContentType, file.size)
      await uploadToR2(presign.uploadUrl, file)
      await onSend({ imageUrl: presign.publicUrl })
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'No se pudo enviar la imagen')
    } finally {
      setIsUploadingImage(false)
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
        {imageError && <ErrorMessage message={imageError} className='mb-2' />}
        <div className='flex items-center gap-2'>
          <label htmlFor='chat-image-input' className='sr-only'>
            Adjuntar imagen
          </label>
          <input
            ref={fileInputRef}
            id='chat-image-input'
            type='file'
            accept={ALLOWED_UPLOAD_TYPES.join(',')}
            className='hidden'
            onChange={handleFileSelect}
            disabled={isUploadingImage}
          />
          <Button
            type='button'
            variant='secondary'
            isLoading={isUploadingImage}
            onClick={() => fileInputRef.current?.click()}
            aria-label='Adjuntar imagen'
          >
            📎
          </Button>

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
