import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ChatList from '@/components/chat/ChatList'
import type { ChatDTO } from '@/types/chat.types'

const USUARIO_ACTUAL = 7

function chat(overrides: Partial<ChatDTO> = {}): ChatDTO {
  return {
    id: 3,
    userAId: USUARIO_ACTUAL,
    userBId: 8,
    reportId: 5,
    createdAt: '2026-09-22T10:00:00.000Z',
    ...overrides,
  }
}

function renderList(props: Partial<Parameters<typeof ChatList>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ChatList
        chats={[chat()]}
        currentUserId={USUARIO_ACTUAL}
        activeChatId={undefined}
        isLoading={false}
        error={null}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('ChatList estados', () => {
  it('muestra el spinner mientras carga', () => {
    renderList({ isLoading: true, chats: [] })

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('muestra el error cuando la carga falla', () => {
    renderList({ error: 'No se pudieron cargar los chats', chats: [] })

    expect(screen.getByText('No se pudieron cargar los chats')).toBeInTheDocument()
  })

  it('avisa cuando todavia no hay conversaciones', () => {
    renderList({ chats: [] })

    expect(screen.getByText('No tenés conversaciones.')).toBeInTheDocument()
  })
})

describe('ChatList listado', () => {
  // El chat guarda los dos participantes sin distinguir quien es "el otro":
  // hay que resolverlo contra el usuario actual, mire desde el lado que mire.
  it('muestra al otro participante cuando el usuario actual es userA', () => {
    renderList({ chats: [chat({ userAId: USUARIO_ACTUAL, userBId: 8 })] })

    expect(screen.getByText('Usuario #8')).toBeInTheDocument()
  })

  it('muestra al otro participante cuando el usuario actual es userB', () => {
    renderList({ chats: [chat({ userAId: 8, userBId: USUARIO_ACTUAL })] })

    expect(screen.getByText('Usuario #8')).toBeInTheDocument()
  })

  it('linkea a la conversacion y referencia el reporte asociado', () => {
    renderList()

    expect(screen.getByRole('link')).toHaveAttribute('href', '/chats/3')
    expect(screen.getByText('Reporte #5')).toBeInTheDocument()
  })

  it('aclara cuando el chat no nacio de un reporte', () => {
    renderList({ chats: [chat({ reportId: null })] })

    expect(screen.getByText('Sin reporte asociado')).toBeInTheDocument()
  })

  it('marca la conversacion abierta con aria-current', () => {
    renderList({ chats: [chat({ id: 3 }), chat({ id: 4, userBId: 9 })], activeChatId: 3 })

    const activo = screen.getByRole('link', { current: 'page' })
    expect(activo).toHaveAttribute('href', '/chats/3')
  })
})
