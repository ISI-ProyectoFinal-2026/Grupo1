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
    analyzeImage: vi.fn(),
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
    vi.mocked(uploadsService.analyzeImage).mockResolvedValue({ hasAnimal: true })
    const onSuccess = vi.fn()

    const { container } = render(<ImageUploader onSuccess={onSuccess} onError={vi.fn()} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, makeFile())

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith('https://cdn.example.com/foto.jpg', null)
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

  describe('animal screening right after the upload', () => {
    beforeEach(() => {
      vi.mocked(uploadsService.getPresignedUrl).mockResolvedValue({
        uploadUrl: 'https://upload.example.com',
        publicUrl: 'https://cdn.example.com/foto.jpg',
        key: 'foto.jpg',
      })
      vi.mocked(uploadsService.uploadToR2).mockResolvedValue(undefined)
    })

    async function uploadWith(onSuccess = vi.fn(), onError = vi.fn(), onUploadingChange = vi.fn()) {
      const user = userEvent.setup()
      const { container } = render(
        <ImageUploader
          onSuccess={onSuccess}
          onError={onError}
          onUploadingChange={onUploadingChange}
          screenForAnimals
        />
      )
      await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, makeFile())
      return { onSuccess, onError, onUploadingChange }
    }

    it('analyzes the uploaded public URL and reports an animal photo as accepted', async () => {
      vi.mocked(uploadsService.analyzeImage).mockResolvedValue({ hasAnimal: true })

      const { onSuccess } = await uploadWith()

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('https://cdn.example.com/foto.jpg', null))
      expect(uploadsService.analyzeImage).toHaveBeenCalledWith('https://cdn.example.com/foto.jpg')
    })

    it('reports a photo without animals as rejected, with the message sent by the backend', async () => {
      vi.mocked(uploadsService.analyzeImage).mockResolvedValue({ hasAnimal: false, message: 'Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM' })

      const { onSuccess, onError } = await uploadWith()

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('https://cdn.example.com/foto.jpg', 'Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM'))
      expect(onError).not.toHaveBeenCalled()
    })

    // The form keeps the submit disabled until the verdict arrives (PR #195 review).
    it('reports the upload as in progress until the analysis finishes', async () => {
      let finishAnalysis: (value: uploadsService.ImageAnalysis) => void = () => {}
      vi.mocked(uploadsService.analyzeImage).mockReturnValue(
        new Promise((resolve) => {
          finishAnalysis = resolve
        })
      )

      const { onSuccess, onUploadingChange } = await uploadWith()

      await waitFor(() => expect(onUploadingChange).toHaveBeenLastCalledWith(true))
      expect(onSuccess).not.toHaveBeenCalled()

      finishAnalysis({ hasAnimal: true })

      await waitFor(() => expect(onUploadingChange).toHaveBeenLastCalledWith(false))
      expect(onSuccess).toHaveBeenCalled()
    })

    it('reports the upload as finished when it fails', async () => {
      vi.mocked(uploadsService.uploadToR2).mockRejectedValue(new Error('HTTP 403'))

      const { onError, onUploadingChange } = await uploadWith()

      await waitFor(() => expect(onError).toHaveBeenCalled())
      expect(onUploadingChange).toHaveBeenLastCalledWith(false)
    })

    it('does not analyze the image unless screening is requested (e.g. custom flyers)', async () => {
      const user = userEvent.setup()
      const onSuccess = vi.fn()
      const { container } = render(<ImageUploader onSuccess={onSuccess} onError={vi.fn()} />)

      await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, makeFile())

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('https://cdn.example.com/foto.jpg', null))
      expect(uploadsService.analyzeImage).not.toHaveBeenCalled()
    })

    it('reports an unknown verdict (null) when the analysis request fails, without blocking', async () => {
      vi.mocked(uploadsService.analyzeImage).mockRejectedValue(new Error('backend caido'))

      const { onSuccess, onError } = await uploadWith()

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('https://cdn.example.com/foto.jpg', null))
      expect(onError).not.toHaveBeenCalled()
    })
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
