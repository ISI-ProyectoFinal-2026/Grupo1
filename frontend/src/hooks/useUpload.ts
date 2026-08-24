import { useCallback, useState } from "react";
import { presign } from "@/api/uploads.api";

interface UseUploadResult {
  uploadFile: (file: File) => Promise<string>;
  progress: number;
  isUploading: boolean;
  error: string | null;
}

const UPLOAD_FAILED_MESSAGE = "No se pudo subir la imagen. Intentá de nuevo.";

function putToR2(uploadUrl: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(UPLOAD_FAILED_MESSAGE));
      }
    };

    xhr.onerror = () => reject(new Error(UPLOAD_FAILED_MESSAGE));

    xhr.send(file);
  });
}

export function useUpload(): UseUploadResult {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      const { uploadUrl, publicUrl } = await presign({
        fileName: file.name,
        contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
        fileSize: file.size,
      });

      await putToR2(uploadUrl, file, setProgress);

      return publicUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : UPLOAD_FAILED_MESSAGE;
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { uploadFile, progress, isUploading, error };
}
