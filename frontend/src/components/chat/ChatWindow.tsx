import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import EmailNotVerifiedNotice from '@/components/auth/EmailNotVerifiedNotice'
import ErrorMessage from '@/components/ui/ErrorMessage'
import Spinner from '@/components/ui/Spinner'
import { PaperclipIcon, SendIcon } from '@/components/ui/icons'
import { getApiErrorCode } from '@/services/api'
import { EMAIL_NOT_VERIFIED } from '@/types/auth'
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
  /** Código de máquina de `sendError` (p. ej. EMAIL_NOT_VERIFIED). */
  sendErrorCode?: string | null
  onSend: (input: SendMessageInput) => Promise<void>
  /** Titulo de la conversacion (ej. el otro participante). */
  title?: string
  /** Contenido al inicio del header, como el link de volver en mobile. */
  headerStart?: ReactNode
}

const MAX_UPLOAD_MB = Math.floor(MAX_UPLOAD_BYTES / 1_000_000)

const statusLabels: Record<ChatConnectionStatus, string> = {
  connecting: 'Conectando…',
  connected: 'En línea',
  reconnecting: 'Reconectando…',
  disconnected: 'Sin conexión',
  unauthorized: 'Sesión expirada',
}

const statusDotClasses: Record<ChatConnectionStatus, string> = {
  connecting: 'bg-signal-deep',
  connected: 'bg-success',
  reconnecting: 'bg-signal-deep',
  disconnected: 'bg-ink-muted',
  unauthorized: 'bg-danger',
}

function ChatWindow({
  messages,
  currentUserId,
  connectionStatus,
  isLoading,
  loadError,
  sendError,
  sendErrorCode = null,
  onSend,
  title,
  headerStart,
}: ChatWindowProps) {
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageErrorCode, setImageErrorCode] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const isUnauthorized = connectionStatus === 'unauthorized'
  // Un solo aviso aunque lo disparen el envío y la subida de la imagen a la vez.
  const needsVerification =
    sendErrorCode === EMAIL_NOT_VERIFIED || imageErrorCode === EMAIL_NOT_VERIFIED

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
    setImageErrorCode(null)

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
      setImageErrorCode(getApiErrorCode(err) ?? null)
    } finally {
      setIsUploadingImage(false)
    }
  }

  return (
    <section className='flex h-full min-h-0 flex-col'>
      <header className='flex min-h-14 items-center gap-2 border-b border-line bg-paper px-2 py-1.5 sm:px-4'>
        {headerStart}
        <div className='min-w-0 flex-1 px-1'>
          {title && <h2 className='truncate font-display text-base font-bold'>{title}</h2>}
          <p className='flex items-center gap-1.5 text-sm text-ink-muted'>
            <span
              aria-hidden='true'
              className={`h-2 w-2 shrink-0 rounded-full ${statusDotClasses[connectionStatus]}`}
            />
            {statusLabels[connectionStatus]}
          </p>
        </div>
      </header>

      <div className='flex-1 overflow-y-auto overscroll-contain bg-surface px-3 py-4 sm:px-5'>
        {isLoading ? (
          <div className='flex h-full items-center justify-center text-ink-muted'>
            <Spinner size='md' />
          </div>
        ) : loadError ? (
          <ErrorMessage message={loadError} />
        ) : messages.length === 0 ? (
          <p className='py-10 text-center text-ink-muted'>
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

      {isUnauthorized ? (
        <div className='border-t border-line bg-paper px-4 py-3'>
          <p className='text-ink'>
            Tu sesión expiró, por eso el chat dejó de recibir mensajes.{' '}
            <Link to='/login' className='font-bold text-ink underline underline-offset-4 hover:no-underline'>
              Iniciá sesión de nuevo
            </Link>{' '}
            para seguir la conversación.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className='border-t border-line bg-paper px-2 py-2 sm:px-4 sm:py-3'>
          {needsVerification ? (
            <EmailNotVerifiedNotice className='mb-2' />
          ) : (
            <>
              {sendError && <ErrorMessage message={sendError} className='mb-2 px-1' />}
              {imageError && <ErrorMessage message={imageError} className='mb-2 px-1' />}
            </>
          )}
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
              variant='ghost'
              isLoading={isUploadingImage}
              onClick={() => fileInputRef.current?.click()}
              aria-label='Adjuntar imagen'
              className='w-11 shrink-0 px-0'
            >
              {!isUploadingImage && <PaperclipIcon className='h-5 w-5' />}
            </Button>

            <label htmlFor='chat-message-input' className='sr-only'>
              Mensaje
            </label>
            <input
              id='chat-message-input'
              type='text'
              autoComplete='off'
              enterKeyHint='send'
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder='Escribí un mensaje…'
              className='field min-w-0 flex-1 rounded-full'
            />
            <Button
              type='submit'
              variant='primary'
              isLoading={isSending}
              disabled={!draft.trim()}
              className='shrink-0 rounded-full px-3 sm:px-4'
            >
              {!isSending && <SendIcon className='h-5 w-5' />}
              <span className='sr-only sm:not-sr-only'>Enviar</span>
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

export default ChatWindow
