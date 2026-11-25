import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { ChatIcon } from '@/components/ui/icons'
import EmailNotVerifiedNotice from '@/components/auth/EmailNotVerifiedNotice'
import { useContactOwner } from '@/hooks/useContactOwner'
import { getApiErrorCode } from '@/services/api'
import { EMAIL_NOT_VERIFIED } from '@/types/auth'

interface ContactOwnerPanelProps {
  reportId: number
  ownerId: number
}

// punto de entrada al chat: ChatList solo muestra chats que ya existen
export default function ContactOwnerPanel({ reportId, ownerId }: ContactOwnerPanelProps) {
  const navigate = useNavigate()
  const contactOwner = useContactOwner(reportId, (chatId) => navigate(`/chats/${chatId}`))

  return (
    <div className='flex flex-col gap-2'>
      <h2 className='sr-only font-display text-display-sm lg:not-sr-only'>
        ¿Tenés información sobre esta mascota?
      </h2>
      <Button
        variant='primary'
        size='lg'
        className='w-full'
        isLoading={contactOwner.isPending}
        onClick={() => contactOwner.contact(ownerId)}
      >
        {!contactOwner.isPending && <ChatIcon className='h-5 w-5' />}
        Contactar al autor
      </Button>
      {contactOwner.error &&
        (getApiErrorCode(contactOwner.error) === EMAIL_NOT_VERIFIED ? (
          <EmailNotVerifiedNotice />
        ) : (
          <ErrorMessage message='No se pudo abrir el chat, intentá de nuevo.' />
        ))}
    </div>
  )
}
