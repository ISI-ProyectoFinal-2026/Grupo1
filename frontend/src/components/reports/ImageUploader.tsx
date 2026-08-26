import { useState, useRef } from "react";
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  getPresignedUrl,
  uploadToR2,
  type UploadContentType,
} from "@/services/uploads.service";
import ErrorMessage from "@/components/ui/ErrorMessage";

interface ImageUploaderProps {
  onSuccess: (publicUrl: string) => void;
  onError: (error: string) => void;
}

export default function ImageUploader({ onSuccess, onError }: ImageUploaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE_MB = Math.floor(MAX_UPLOAD_BYTES / 1_000_000);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

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
    try {
      const presignData = await getPresignedUrl(
        file.name,
        file.type as UploadContentType,
        file.size
      );
      await uploadToR2(presignData.uploadUrl, file);
      onSuccess(presignData.publicUrl);
      setPreview(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al subir imagen";
      setError(message);
      onError(message);
      setPreview(null);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center w-full">
        <label
          htmlFor="image-input"
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 bg-gray-50"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {preview ? (
              <>
                <img src={preview} alt="preview" className="h-20 w-20 object-cover rounded" />
                <p className="text-xs text-gray-500 mt-2">Subiendo...</p>
              </>
            ) : (
              <>
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm text-gray-600 mt-2">
                  Click aquí o arrastra una imagen
                </p>
                    <p className="text-xs text-gray-500">
                  JPG, PNG o WebP (máx. {MAX_SIZE_MB}MB)
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            id="image-input"
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            disabled={isLoading}
          />
        </label>
      </div>
      {error && <ErrorMessage message={error} />}
    </div>
  );
}
