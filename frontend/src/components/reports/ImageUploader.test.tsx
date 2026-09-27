import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImageUploader from '@/components/reports/ImageUploader'
import * as uploadsService from '@/services/uploads.service'

vi.mock('@/services/uploads.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/uploads.service')>(
    '@/services/uploads.service'
  )
  return {
    ...actual,
    getPresignedUrl: vi.fn(),
    uploadToR2: vi.fn(),
  }
})

function makeFile(name = 'foto.jpg', type = 'image/jpeg') {
  return new File(['contenido'], name, { type })
}

describe('ImageUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
  })

  it('revoca el object URL del preview despues de subir la imagen', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadsService.getPresignedUrl).mockResolvedValue({
      uploadUrl: 'https://upload.example.com',
      publicUrl: 'https://cdn.example.com/foto.jpg',
      key: 'foto.jpg',
    })
    vi.mocked(uploadsService.uploadToR2).mockResolvedValue(undefined)
    const onSuccess = vi.fn()

    const { container } = render(<ImageUploader onSuccess={onSuccess} onError={vi.fn()} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, makeFile())

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith('https://cdn.example.com/foto.jpg')
    )

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('revoca el object URL del preview si la subida falla', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadsService.getPresignedUrl).mockRejectedValue(new Error('presign caido'))
    const onError = vi.fn()

    const { container } = render(<ImageUploader onSuccess={vi.fn()} onError={onError} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, makeFile())

    await waitFor(() => expect(onError).toHaveBeenCalled())

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('genera un id unico por instancia para que dos uploaders no colisionen', () => {
    const { container: firstContainer } = render(
      <ImageUploader onSuccess={vi.fn()} onError={vi.fn()} />
    )
    const { container: secondContainer } = render(
      <ImageUploader onSuccess={vi.fn()} onError={vi.fn()} />
    )

    const firstInput = firstContainer.querySelector('input[type="file"]') as HTMLInputElement
    const secondInput = secondContainer.querySelector('input[type="file"]') as HTMLInputElement
    const firstLabel = firstContainer.querySelector('label') as HTMLLabelElement
    const secondLabel = secondContainer.querySelector('label') as HTMLLabelElement

    expect(firstInput.id).not.toBe(secondInput.id)
    expect(firstLabel.getAttribute('for')).toBe(firstInput.id)
    expect(secondLabel.getAttribute('for')).toBe(secondInput.id)
  })
})
