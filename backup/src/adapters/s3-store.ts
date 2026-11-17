import fs from "fs";
import { pipeline } from "stream/promises";
import type { Readable } from "stream";
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type DeleteObjectsCommandOutput,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import type { R2Config } from "../config";
import type { ObjectStore, StoredObject } from "../ports";

// límite de DeleteObjects por pedido
const DELETE_BATCH = 1000;

export interface S3Like {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send(command: any): Promise<any>;
}

export function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: "auto",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

// CopySource es "bucket/clave" con la clave codificada, conservando las "/"
function copySource(bucket: string, key: string): string {
  return `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export class S3ObjectStore implements ObjectStore {
  constructor(private readonly client: S3Like) {}

  async list(bucket: string, prefix?: string): Promise<StoredObject[]> {
    const objects: StoredObject[] = [];
    let token: string | undefined;
    do {
      const page: ListObjectsV2CommandOutput = await this.client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token })
      );
      for (const item of page.Contents ?? []) {
        objects.push({ key: item.Key ?? "", size: item.Size ?? 0, etag: item.ETag ?? "" });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return objects;
  }

  async upload(bucket: string, key: string, filePath: string): Promise<void> {
    const { size } = await fs.promises.stat(filePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fs.createReadStream(filePath),
        ContentLength: size,
        ContentType: "application/octet-stream",
      })
    );
  }

  async download(bucket: string, key: string, filePath: string): Promise<void> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) throw new Error(`R2 devolvió ${bucket}/${key} sin contenido`);
    await pipeline(result.Body as Readable, fs.createWriteStream(filePath));
  }

  async copy(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: destBucket,
        Key: destKey,
        CopySource: copySource(sourceBucket, sourceKey),
      })
    );
  }

  async remove(bucket: string, keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += DELETE_BATCH) {
      const batch = keys.slice(i, i + DELETE_BATCH);
      const result: DeleteObjectsCommandOutput = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        })
      );
      if (result?.Errors?.length) {
        const detail = result.Errors.map((e) => `${e.Key}: ${e.Message ?? e.Code}`).join("; ");
        throw new Error(`R2 no pudo borrar: ${detail}`);
      }
    }
  }
}
