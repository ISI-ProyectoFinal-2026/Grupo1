import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../errors/app-error";
import { PresignUploadInput } from "../validators/uploads.validator";

const PRESIGN_EXPIRY_SECONDS = 300;

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const REQUIRED_R2_VARS = [
  "R2_ENDPOINT",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
] as const;

/**
 * Sin esta guarda, un .env sin las claves de R2 llega hasta el SDK de AWS y
 * revienta con "No value provided for input HTTP label: Bucket", un 500 mudo
 * que no dice cuál es la variable que falta. Se valida acá y no al arrancar el
 * server para que el resto de la API siga levantando en entornos de desarrollo
 * donde todavía no se configuró el bucket.
 */
function assertR2Configured(): void {
  const missing = REQUIRED_R2_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new AppError(
      503,
      "El servicio de almacenamiento de imágenes no está configurado",
      { missingEnvVars: missing }
    );
  }
}

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
  assertR2Configured();

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

/**
 * Sube un buffer generado por el propio backend (ej. un flyer compuesto en
 * canvas) directo a R2, sin pasar por el flujo de presigned URL que usa el
 * cliente para sus propias fotos.
 */
export async function uploadBuffer(key: string, body: Buffer, contentType: string): Promise<string> {
  assertR2Configured();

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
