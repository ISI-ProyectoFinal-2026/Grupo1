import { api } from "./api";

export type UploadContentType = "image/jpeg" | "image/png" | "image/webp";

/**
 * Debe coincidir con MAX_FILE_SIZE de backend/src/validators/uploads.validator.ts.
 * Si el frontend valida por debajo del backend, rechaza fotos que el servidor
 * habría aceptado sin que el usuario entienda por qué.
 */
export const MAX_UPLOAD_BYTES = 10_000_000;

export const ALLOWED_UPLOAD_TYPES: UploadContentType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export interface PresignedUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

/**
 * El backend valida el tamaño antes de firmar la URL, así que `fileSize` es
 * obligatorio en el body: omitirlo devuelve 400 y el upload nunca arranca.
 */
export async function getPresignedUrl(
  fileName: string,
  contentType: UploadContentType,
  fileSize: number
): Promise<PresignedUploadResponse> {
  const { data } = await api.post<PresignedUploadResponse>("/uploads/presign", {
    fileName,
    contentType,
    fileSize,
  });
  return data;
}

export async function uploadToR2(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });

  // fetch solo rechaza ante fallas de red: un 403 por firma vencida o un
  // bucket sin CORS resuelven como cualquier otra respuesta. Sin este chequeo
  // el reporte se creaba apuntando a un objeto que nunca llegó a R2.
  if (!response.ok) {
    throw new Error(
      `No se pudo subir la imagen (HTTP ${response.status}). La URL de subida vence a los 5 minutos: volvé a elegir la foto.`
    );
  }
}

/**
 * `hasAnimal: null` means the AI service could not answer: the user must not be
 * blocked. A rejection (`hasAnimal: false`) carries the message to show, so its
 * wording lives only in the backend, next to the 422 it returns for the same rule.
 */
export type ImageAnalysis =
  | { hasAnimal: true | null }
  | { hasAnimal: false; message: string };

/** Asks the backend whether an uploaded image contains any animal. */
export async function analyzeImage(imageUrl: string): Promise<ImageAnalysis> {
  const { data } = await api.post<ImageAnalysis>("/uploads/analyze", { imageUrl });
  return data;
}
