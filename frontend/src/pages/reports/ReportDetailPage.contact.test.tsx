import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as reportsService from '@/services/reports.service'
import * as chatsService from '@/services/chats.service'
import { useAuthStore } from '@/stores/auth.store'
import ReportDetailPage from '@/pages/reports/ReportDetailPage'
import type { ReportDTO } from '@/types/report.types'
import type { ChatDTO } from '@/types/chat.types'

vi.mock('@/services/reports.service')
vi.mock('@/services/chats.service')

const REPORT_ID = 5
const AUTHOR_ID = 20
const VIEWER_ID = 10

function reporte(overrides: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: REPORT_ID,
    userId: AUTHOR_ID,
    petId: null,
    reportType: 'lost',
    status: 'published',
    title: 'Perro perdido en el parque',
    description: null,
    imageUrl: null,
    customFlyerUrl: null,
    locationAddress: null,
    location: null,
    tag: { label: 'Perdido', color: '#EF4444' },
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    publishedAt: null,
    ...overrides,
  }
}

function chat(overrides: Partial<ChatDTO> = {}): ChatDTO {
  return {
    id: 42,
    userAId: VIEWER_ID,
    userBId: AUTHOR_ID,
    reportId: REPORT_ID,
    createdAt: '2026-09-02T10:00:00.000Z',
    ...overrides,
  }
}

function ChatDestino() {
  const { id } = useParams<{ id: string }>()
  return <div>Chat {id}</div>
}

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={[`/reports/${REPORT_ID}`]}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetailPage />} />
          <Route path="/chats/:id" element={<ChatDestino />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

describe('ReportDetailPage - contactar al autor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte())
    vi.mocked(reportsService.getMatches).mockResolvedValue([])
    useAuthStore.setState({
      token: 'token',
      user: {
        id: VIEWER_ID,
        email: 'viewer@example.com',
        fullName: null,
        phone: null,
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
      },
    })
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('crea el chat de este reporte con el autor y navega a él', async () => {
    vi.mocked(chatsService.createChat).mockResolvedValue(chat({ id: 42 }))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /contactar al autor/i }))

    expect(await screen.findByText('Chat 42')).toBeInTheDocument()
    expect(chatsService.createChat).toHaveBeenCalledWith({ reportId: REPORT_ID, participantId: AUTHOR_ID })
  })

  it('si el chat ya existía, el backend lo devuelve y se navega a ese mismo chat sin listar otros', async () => {
    vi.mocked(chatsService.createChat).mockResolvedValue(chat({ id: 7 }))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /contactar al autor/i }))

    expect(await screen.findByText('Chat 7')).toBeInTheDocument()
    expect(chatsService.listChats).not.toHaveBeenCalled()
  })

  it('ante un error real no navega a un chat de otro reporte: muestra el error', async () => {
    vi.mocked(chatsService.createChat).mockRejectedValue(new Error('Request failed with status code 500'))
    // un chat previo con el mismo autor pero de OTRO reporte: no hay que abrirlo
    vi.mocked(chatsService.listChats).mockResolvedValue([chat({ id: 99, reportId: 123 })])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /contactar al autor/i }))

    expect(await screen.findByText(/no se pudo abrir el chat/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Chat 99')).not.toBeInTheDocument())
    expect(chatsService.listChats).not.toHaveBeenCalled()
  })
})
