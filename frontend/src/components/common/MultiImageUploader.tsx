import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import ActionErrorMessage from '@/components/auth/ActionErrorMessage'
import Button from '@/components/ui/Button'
import { CameraIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { NO_SCREENING, screenImage } from '@/lib/screen-image'
import { getApiErrorCode } from '@/services/api'
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  getPresignedUrl,
  uploadToR2,
  type UploadContentType,
} from '@/services/uploads.service'

interface MultiImageUploaderProps {
  value: string[]
  onChange: (urls: string[]) => void
  max: number
  // screening de animales tras subir (#254)
  screenForAnimals?: boolean
  onUploadingChange?: (uploading: boolean) => void
}

interface Notice {
  id: string
  text: string
  tone: 'error' | 'warning'
  code?: string | null
}

const MAX_SIZE_MB = Math.floor(MAX_UPLOAD_BYTES / 1_000_000)

function validateFile(file: File): string | null {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type as UploadContentType)) {
    return 'solo se permiten JPG, PNG o WebP'
  }
  if (file.size > MAX_UPLOAD_BYTES) return `la imagen debe pesar menos de ${MAX_SIZE_MB}MB`
  return null
}

async function uploadFile(file: File, screenForAnimals: boolean) {
  const presign = await getPresignedUrl(file.name, file.type as UploadContentType, file.size)
  await uploadToR2(presign.uploadUrl, file)
  const screening = screenForAnimals ? await screenImage(presign.publicUrl) : NO_SCREENING
  return { publicUrl: presign.publicUrl, ...screening }
}

export default function MultiImageUploader({
  value,
  onChange,
  max,
  screenForAnimals = false,
  onUploadingChange,
}: MultiImageUploaderProps) {
  const inputId = useId()
  const [isUploading, setIsUploading] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  // valor vigente al terminar la subida
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])

  const isFull = value.length >= max

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (files.length === 0) return

    const next: Notice[] = []
    const toUpload: File[] = []
    let freeSlots = max - value.length
    files.forEach((file, index) => {
      const invalid = validateFile(file)
      if (invalid) {
        next.push({ id: `${index}-invalid`, text: `${file.name}: ${invalid}`, tone: 'error' })
      } else if (freeSlots <= 0) {
        next.push({
          id: `${index}-full`,
          text: `${file.name}: se alcanzó el máximo de ${max} fotos`,
          tone: 'error',
        })
      } else {
        toUpload.push(file)
        freeSlots -= 1
      }
    })
    setNotices(next)
    if (toUpload.length === 0) return

    setIsUploading(true)
    onUploadingChange?.(true)
    const results = await Promise.allSettled(toUpload.map((file) => uploadFile(file, screenForAnimals)))

    const accepted: string[] = []
    results.forEach((result, index) => {
      const name = toUpload[index].name
      const id = `upload-${index}`
      if (result.status === 'rejected') {
        const err = result.reason
        const message = err instanceof Error ? err.message : 'Error al subir imagen'
        next.push({ id, text: `${name}: ${message}`, tone: 'error', code: getApiErrorCode(err) })
      } else if (result.value.rejection) {
        next.push({ id, text: `${name}: ${result.value.rejection}`, tone: 'error' })
      } else {
        accepted.push(result.value.publicUrl)
        if (result.value.qualityWarning) {
          next.push({ id, text: `${name}: ${result.value.qualityWarning}`, tone: 'warning' })
        }
      }
    })

    setNotices([...next])
    if (accepted.length > 0) onChange([...valueRef.current, ...accepted].slice(0, max))
    setIsUploading(false)
    onUploadingChange?.(false)
  }

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index))

  const makeMain = (index: number) =>
    onChange([value[index], ...value.filter((_, i) => i !== index)])

  return (
    <div className='flex flex-col gap-3'>
      <p className='text-sm text-ink-muted' aria-live='polite'>
        <span className='font-bold text-ink'>{`${value.length}/${max}`}</span>
      </p>

      {value.length > 0 && (
        <ul className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          {value.map((url, index) => (
            <li key={`${url}-${index}`} className='flex flex-col gap-1.5'>
              <div className='relative'>
                <img
                  src={url}
                  alt={`Foto ${index + 1}`}
                  className='aspect-square w-full rounded-control border border-line object-cover'
                />
                {index === 0 && (
                  <span className='absolute left-1.5 top-1.5 rounded-full bg-signal px-2 py-0.5 text-xs font-bold text-ink'>
                    Principal
                  </span>
                )}
              </div>
              {index > 0 && (
                <Button
                  variant='secondary'
                  size='sm'
                  aria-label={`Usar foto ${index + 1} como principal`}
                  onClick={() => makeMain(index)}
                  disabled={isUploading}
                >
                  Hacer principal
                </Button>
              )}
              <Button
                variant='ghost'
                size='sm'
                aria-label={`Quitar foto ${index + 1}`}
                onClick={() => remove(index)}
                disabled={isUploading}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}

      {isFull ? (
        <p className='text-sm text-ink-muted'>{`Llegaste al máximo de ${max} fotos.`}</p>
      ) : (
        <label
          htmlFor={inputId}
          className={cn(
            'group flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-line bg-surface px-4 py-6 text-center transition-[border-color,background-color,transform] duration-fast ease-out hover:border-ink-muted hover:bg-paper active:scale-[0.99]',
            'has-[:focus-visible]:border-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/25',
            isUploading && 'cursor-progress'
          )}
        >
          <span className='grid h-12 w-12 place-items-center rounded-full bg-paper text-ink-muted shadow-card ring-1 ring-line transition-transform duration-fast ease-out group-hover:-translate-y-0.5'>
            <CameraIcon className='h-6 w-6' />
          </span>
          <span className='mt-1 font-bold text-ink'>
            {isUploading ? 'Subiendo fotos…' : 'Tocá para elegir fotos'}
          </span>
          <span className='text-sm text-ink-muted'>
            {`Hasta ${max - value.length} más · JPG, PNG o WebP (máx. ${MAX_SIZE_MB}MB)`}
          </span>
          <input
            id={inputId}
            type='file'
            multiple
            className='sr-only'
            accept='image/jpeg,image/png,image/webp'
            onChange={handleFiles}
            disabled={isUploading}
          />
        </label>
      )}

      {notices.map((notice) =>
        notice.tone === 'error' ? (
          <ActionErrorMessage key={notice.id} message={notice.text} code={notice.code} />
        ) : (
          <p
            key={notice.id}
            role='status'
            className='animate-drop rounded-control border border-signal bg-signal/15 px-3 py-2.5 text-sm text-ink'
          >
            {notice.text}
          </p>
        )
      )}
    </div>
  )
}
