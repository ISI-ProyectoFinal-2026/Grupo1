import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MultiImageUploader from '@/components/common/MultiImageUploader'
import * as uploadsService from '@/services/uploads.service'

vi.mock('@/services/uploads.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/uploads.service')>(
    '@/services/uploads.service'
  )
  return { ...actual, getPresignedUrl: vi.fn(), uploadToR2: vi.fn(), analyzeImage: vi.fn() }
})

const NO_ANIMAL = 'Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM'
const BLURRY = 'La foto parece borrosa o movida.'
const url = (name: string) => `https://pub.r2.dev/pets/${name}`

function makeFile(name: string, type = 'image/jpeg', size = 10) {
  return new File(['x'.repeat(size)], name, { type })
}

// arnes controlado: el componente es "value/onChange"
function Harness({
  initial = [],
  max = 4,
  screenForAnimals = false,
  onUploadingChange,
  onChangeSpy,
}: {
  initial?: string[]
  max?: number
  screenForAnimals?: boolean
  onUploadingChange?: (uploading: boolean) => void
  onChangeSpy?: (urls: string[]) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <MultiImageUploader
      value={value}
      onChange={(urls) => {
        onChangeSpy?.(urls)
        setValue(urls)
      }}
      max={max}
      screenForAnimals={screenForAnimals}
      onUploadingChange={onUploadingChange}
    />
  )
}

const fileInput = () => screen.getByLabelText(/elegir fotos/i) as HTMLInputElement
const thumbnails = () => screen.queryAllByRole('img').map((img) => img.getAttribute('src'))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(uploadsService.getPresignedUrl).mockImplementation(async (fileName) => ({
    uploadUrl: 'https://upload.example.com',
    publicUrl: url(fileName),
    key: fileName,
  }))
  vi.mocked(uploadsService.uploadToR2).mockResolvedValue(undefined)
  vi.mocked(uploadsService.analyzeImage).mockResolvedValue({ hasAnimal: true, lowQuality: false })
})

describe('MultiImageUploader: seleccion multiple', () => {
  it('permite elegir varios archivos a la vez', () => {
    render(<Harness />)

    expect(fileInput()).toHaveAttribute('multiple')
  })

  it('sube cada archivo elegido y los agrega en orden', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.upload(fileInput(), [makeFile('a.jpg'), makeFile('b.jpg')])

    await waitFor(() => expect(thumbnails()).toEqual([url('a.jpg'), url('b.jpg')]))
    expect(uploadsService.uploadToR2).toHaveBeenCalledTimes(2)
  })

  it('muestra el contador de fotos', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByText('0/4')).toBeInTheDocument()
    await user.upload(fileInput(), [makeFile('a.jpg')])

    expect(await screen.findByText('1/4')).toBeInTheDocument()
  })

  it('solo sube hasta completar los lugares libres y avisa', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[url('x.jpg'), url('y.jpg'), url('z.jpg')]} />)

    await user.upload(fileInput(), [makeFile('a.jpg'), makeFile('b.jpg')])

    await waitFor(() => expect(thumbnails()).toHaveLength(4))
    expect(uploadsService.uploadToR2).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/b\.jpg: se alcanzó el máximo de 4 fotos/)).toBeInTheDocument()
  })

  it('oculta la carga al llegar al maximo', () => {
    render(<Harness initial={['1', '2', '3', '4'].map((n) => url(`${n}.jpg`))} />)

    expect(screen.queryByLabelText(/elegir fotos/i)).not.toBeInTheDocument()
    expect(screen.getByText('4/4')).toBeInTheDocument()
  })

  it('avisa la subida en curso al padre', async () => {
    const user = userEvent.setup()
    const onUploadingChange = vi.fn()
    render(<Harness onUploadingChange={onUploadingChange} />)

    await user.upload(fileInput(), [makeFile('a.jpg')])

    await waitFor(() => expect(onUploadingChange).toHaveBeenLastCalledWith(false))
    expect(onUploadingChange).toHaveBeenCalledWith(true)
  })
})

describe('MultiImageUploader: errores por archivo', () => {
  it('rechaza un tipo no permitido sin subirlo y sube el resto', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<Harness />)

    await user.upload(fileInput(), [makeFile('doc.gif', 'image/gif'), makeFile('a.jpg')])

    expect(await screen.findByText('doc.gif: solo se permiten JPG, PNG o WebP')).toBeInTheDocument()
    await waitFor(() => expect(thumbnails()).toEqual([url('a.jpg')]))
    expect(uploadsService.uploadToR2).toHaveBeenCalledTimes(1)
  })

  it('rechaza un archivo demasiado pesado', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const pesado = makeFile('grande.jpg')
    Object.defineProperty(pesado, 'size', { value: uploadsService.MAX_UPLOAD_BYTES + 1 })

    await user.upload(fileInput(), [pesado])

    expect(await screen.findByText('grande.jpg: la imagen debe pesar menos de 10MB')).toBeInTheDocument()
    expect(uploadsService.getPresignedUrl).not.toHaveBeenCalled()
  })

  it('informa la falla de subida de un archivo', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadsService.uploadToR2).mockRejectedValueOnce(new Error('R2 caido'))
    render(<Harness />)

    await user.upload(fileInput(), [makeFile('a.jpg'), makeFile('b.jpg')])

    expect(await screen.findByText('a.jpg: R2 caido')).toBeInTheDocument()
    await waitFor(() => expect(thumbnails()).toEqual([url('b.jpg')]))
  })

  it('con screening descarta la foto sin animales y muestra el motivo', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadsService.analyzeImage).mockImplementation(async (imageUrl) =>
      imageUrl === url('paisaje.jpg')
        ? { hasAnimal: false, lowQuality: false, message: NO_ANIMAL }
        : { hasAnimal: true, lowQuality: false }
    )
    render(<Harness screenForAnimals />)

    await user.upload(fileInput(), [makeFile('paisaje.jpg'), makeFile('a.jpg')])

    expect(await screen.findByText(`paisaje.jpg: ${NO_ANIMAL}`)).toBeInTheDocument()
    await waitFor(() => expect(thumbnails()).toEqual([url('a.jpg')]))
  })

  it('con screening agrega la foto borrosa con un aviso no bloqueante', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadsService.analyzeImage).mockResolvedValue({
      hasAnimal: true,
      lowQuality: true,
      qualityMessage: BLURRY,
    })
    render(<Harness screenForAnimals />)

    await user.upload(fileInput(), [makeFile('borrosa.jpg')])

    await waitFor(() => expect(thumbnails()).toEqual([url('borrosa.jpg')]))
    expect(screen.getByText(`borrosa.jpg: ${BLURRY}`).closest('[role="status"]')).not.toBeNull()
  })

  it('sin screening no analiza las fotos', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.upload(fileInput(), [makeFile('a.jpg')])

    await waitFor(() => expect(thumbnails()).toHaveLength(1))
    expect(uploadsService.analyzeImage).not.toHaveBeenCalled()
  })

  it('limpia los avisos anteriores en una nueva seleccion', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<Harness />)

    await user.upload(fileInput(), [makeFile('doc.gif', 'image/gif')])
    await screen.findByText(/doc\.gif/)
    await user.upload(fileInput(), [makeFile('a.jpg')])

    await waitFor(() => expect(thumbnails()).toHaveLength(1))
    expect(screen.queryByText(/doc\.gif/)).not.toBeInTheDocument()
  })
})

describe('MultiImageUploader: orden y quitar', () => {
  const tres = [url('a.jpg'), url('b.jpg'), url('c.jpg')]

  it('marca la primera foto como principal', () => {
    render(<Harness initial={tres} />)

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Principal')
    expect(items[1]).not.toHaveTextContent('Principal')
    expect(screen.queryByRole('button', { name: 'Usar foto 1 como principal' })).not.toBeInTheDocument()
  })

  it('convierte otra foto en principal moviendola al inicio', async () => {
    const user = userEvent.setup()
    const onChangeSpy = vi.fn()
    render(<Harness initial={tres} onChangeSpy={onChangeSpy} />)

    await user.click(screen.getByRole('button', { name: 'Usar foto 3 como principal' }))

    expect(onChangeSpy).toHaveBeenLastCalledWith([url('c.jpg'), url('a.jpg'), url('b.jpg')])
    expect(thumbnails()).toEqual([url('c.jpg'), url('a.jpg'), url('b.jpg')])
  })

  it('quita la foto elegida y vuelve a habilitar la carga', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['1', '2', '3', '4'].map((n) => url(`${n}.jpg`))} />)

    await user.click(screen.getByRole('button', { name: 'Quitar foto 2' }))

    expect(thumbnails()).toEqual([url('1.jpg'), url('3.jpg'), url('4.jpg')])
    expect(screen.getByText('3/4')).toBeInTheDocument()
    expect(fileInput()).toBeInTheDocument()
  })

  it('respeta un maximo distinto', () => {
    render(<Harness max={2} initial={[url('a.jpg')]} />)

    expect(screen.getByText('1/2')).toBeInTheDocument()
  })
})
