import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PresignUploadInput } from "../validators/uploads.validator";

const PRESIGN_EXPIRY_SECONDS = 300;

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getS3Client(): S3Client {
  return new S3Client({
    endpoint: process.env.R2_ENDPOINT,
    region: "auto",
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });
}

function buildObjectKey(contentType: string): string {
  const extension = CONTENT_TYPE_EXTENSIONS[contentType] ?? "bin";
  return `pets/${randomUUID()}.${extension}`;
}

export interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function createPresignedUpload(data: PresignUploadInput): Promise<PresignedUpload> {
  const key = buildObjectKey(data.contentType);
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: data.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  return { uploadUrl, publicUrl, key };
}
