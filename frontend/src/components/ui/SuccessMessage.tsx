import { CheckIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

interface SuccessMessageProps {
  message: string
  className?: string
}

// Same look as the notices on Login, for the flash messages that travel in the
// navigation state (create, edit, delete).
export default function SuccessMessage({ message, className = '' }: SuccessMessageProps) {
  return (
    <p
      role='status'
      className={cn(
        'flex items-start gap-2 rounded-control bg-success-soft px-3 py-2.5 text-sm font-bold text-success-ink ring-1 ring-inset ring-success/15',
        className
      )}
    >
      <CheckIcon className='h-5 w-5 shrink-0' />
      <span>{message}</span>
    </p>
  )
}
