import { api } from "./api";

export interface PresignedUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function getPresignedUrl(
  fileName: string,
  contentType: "image/jpeg" | "image/png" | "image/webp"
): Promise<PresignedUploadResponse> {
  const { data } = await api.post<PresignedUploadResponse>("/uploads/presign", {
    fileName,
    contentType,
  });
  return data;
}

export async function uploadToR2(uploadUrl: string, file: File): Promise<void> {
  await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });
}
