export interface PresignedUpload {
  uploadUrl: string
  publicUrl: string
  key: string
}

export interface PresignUploadInput {
  fileName: string
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
  fileSize: number
}
