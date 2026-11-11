import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ReportPhotoGallery from './ReportPhotoGallery'

const PRINCIPAL = 'https://cdn/principal.jpg'
const EXTRAS = ['https://cdn/extra-1.jpg', 'https://cdn/extra-2.jpg']

describe('ReportPhotoGallery', () => {
  it('sin fotos extra muestra solo la principal, sin miniaturas', () => {
    render(<ReportPhotoGallery mainUrl={PRINCIPAL} extraUrls={[]} alt='Perro perdido' />)

    expect(screen.getByRole('img', { name: 'Perro perdido' })).toHaveAttribute('src', PRINCIPAL)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('con fotos extra muestra una miniatura por foto y marca la actual', () => {
    render(<ReportPhotoGallery mainUrl={PRINCIPAL} extraUrls={EXTRAS} alt='Perro perdido' />)

    const miniaturas = screen.getAllByRole('button', { name: /Ver foto \d de 3/ })
    expect(miniaturas).toHaveLength(3)
    expect(miniaturas[0]).toHaveAttribute('aria-pressed', 'true')
    expect(miniaturas[1]).toHaveAttribute('aria-pressed', 'false')
  })

  it('al elegir una miniatura cambia la foto grande', async () => {
    const user = userEvent.setup()
    render(<ReportPhotoGallery mainUrl={PRINCIPAL} extraUrls={EXTRAS} alt='Perro perdido' />)

    await user.click(screen.getByRole('button', { name: 'Ver foto 3 de 3' }))

    expect(screen.getByRole('img', { name: 'Perro perdido (foto 3 de 3)' })).toHaveAttribute('src', EXTRAS[1])
    expect(screen.getByRole('button', { name: 'Ver foto 3 de 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Ver foto 1 de 3' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('tolera un reporte sin la lista de fotos extra', () => {
    render(<ReportPhotoGallery mainUrl={PRINCIPAL} alt='Perro perdido' />)

    expect(screen.getByRole('img', { name: 'Perro perdido' })).toHaveAttribute('src', PRINCIPAL)
  })
})
