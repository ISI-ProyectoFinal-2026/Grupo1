import { useId, useState, useRef } from "react";
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  analyzeImage,
  getPresignedUrl,
  uploadToR2,
  type UploadContentType,
} from "@/services/uploads.service";
import ActionErrorMessage from "@/components/auth/ActionErrorMessage";
import { CameraIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { getApiErrorCode } from "@/services/api";

interface ImageUploaderProps {
  /**
   * `rejection` is the message to show when the screening found no animal in the
   * uploaded photo; null means it was accepted, or the analysis was unavailable
   * or not requested.
   */
  onSuccess: (publicUrl: string, rejection: string | null) => void;
  /** `code` is the backend machine code (e.g. EMAIL_NOT_VERIFIED) when there is one. */
  onError: (error: string, code?: string) => void;
  /**
   * True from the moment a file is picked until its upload (and screening, when
   * requested) finishes, so the parent can hold back actions that need the result.
   */
  onUploadingChange?: (uploading: boolean) => void;
  /** Run the animal screening after the upload (report photos, not custom flyers). */
  screenForAnimals?: boolean;
}

// Best-effort: the upload itself already succeeded, so a failed analysis is an
// unknown verdict (no rejection) rather than an upload error. The backend
// re-checks the image when the report is created anyway.
async function getRejection(publicUrl: string): Promise<string | null> {
  try {
    const analysis = await analyzeImage(publicUrl);
    return analysis.hasAnimal === false ? analysis.message : null;
  } catch {
    return null;
  }
}

export default function ImageUploader({
  onSuccess,
  onError,
  onUploadingChange,
  screenForAnimals = false,
}: ImageUploaderProps) {
  const inputId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE_MB = Math.floor(MAX_UPLOAD_BYTES / 1_000_000);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setErrorCode(null);

    if (!ALLOWED_UPLOAD_TYPES.includes(file.type as UploadContentType)) {
      setError("Solo se permiten JPG, PNG o WebP");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`La imagen debe pesar menos de ${MAX_SIZE_MB}MB`);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    setIsLoading(true);
    onUploadingChange?.(true);
    try {
      const presignData = await getPresignedUrl(
        file.name,
        file.type as UploadContentType,
        file.size
      );
      await uploadToR2(presignData.uploadUrl, file);
      const rejection = screenForAnimals ? await getRejection(presignData.publicUrl) : null;
      onSuccess(presignData.publicUrl, rejection);
      URL.revokeObjectURL(previewUrl);
      setPreview(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al subir imagen";
      const code = getApiErrorCode(err);
      setError(message);
      setErrorCode(code ?? null);
      onError(message, code);
      URL.revokeObjectURL(previewUrl);
      setPreview(null);
    } finally {
      setIsLoading(false);
      onUploadingChange?.(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        className={cn(
          "flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-line bg-surface px-4 py-6 text-center transition-colors hover:border-ink-muted",
          "has-[:focus-visible]:border-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/25",
          isLoading && "cursor-progress",
        )}
      >
        {preview ? (
          <>
            <img src={preview} alt="preview" width={80} height={80} className="h-20 w-20 rounded-control object-cover" />
            <p className="mt-2 text-sm text-ink-muted">Subiendo…</p>
          </>
        ) : (
          <>
            <CameraIcon className="h-8 w-8 text-ink-muted" />
            <p className="mt-1 font-bold text-ink">Tocá para elegir una foto</p>
            <p className="text-sm text-ink-muted">
              JPG, PNG o WebP (máx. {MAX_SIZE_MB}MB)
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          disabled={isLoading}
        />
      </label>
      {error && <ActionErrorMessage message={error} code={errorCode} />}
    </div>
  );
}
