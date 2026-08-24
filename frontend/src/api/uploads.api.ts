import client from "./client";
import type { PresignedUpload, PresignUploadInput } from "@/types";

export async function presign(data: PresignUploadInput): Promise<PresignedUpload> {
  const { data: presigned } = await client.post<PresignedUpload>("/uploads/presign", data);
  return presigned;
}
