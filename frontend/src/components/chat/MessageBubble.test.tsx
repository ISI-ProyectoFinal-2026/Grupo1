import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MessageBubble from '@/components/chat/MessageBubble'
import type { MessageDTO } from '@/types/chat.types'

function mensaje(overrides: Partial<MessageDTO> = {}): MessageDTO {
  return {
    id: 1,
    chatId: 3,
    senderId: 7,
    content: 'Hola, creo que vi a tu perro',
    imageUrl: null,
    createdAt: '2026-09-22T13:05:00.000Z',
    ...overrides,
  }
}

describe('MessageBubble', () => {
  it('muestra el texto del mensaje', () => {
    render(<MessageBubble message={mensaje()} isOwn={false} />)

    expect(screen.getByText('Hola, creo que vi a tu perro')).toBeInTheDocument()
  })

  it('alinea a la derecha los mensajes propios', () => {
    const { container } = render(<MessageBubble message={mensaje()} isOwn />)

    expect(container.querySelector('li')).toHaveClass('justify-end')
  })

  it('alinea a la izquierda los mensajes del otro participante', () => {
    const { container } = render(<MessageBubble message={mensaje()} isOwn={false} />)

    expect(container.querySelector('li')).toHaveClass('justify-start')
  })

  it('abre la imagen en otra pestana cuando el mensaje es una foto', () => {
    render(
      <MessageBubble
        message={mensaje({ content: null, imageUrl: 'https://cdn/foto.jpg' })}
        isOwn={false}
      />
    )

    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://cdn/foto.jpg')
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
    expect(screen.getByAltText('Imagen enviada en el chat')).toBeInTheDocument()
  })

  it('expone la fecha completa en el time para lectores de pantalla', () => {
    const { container } = render(<MessageBubble message={mensaje()} isOwn={false} />)

    expect(container.querySelector('time')).toHaveAttribute(
      'dateTime',
      '2026-09-22T13:05:00.000Z'
    )
  })
})
