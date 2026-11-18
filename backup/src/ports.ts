// efectos externos detrás de interfaces para poder testear la orquestación con fakes

export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

export interface StoredObject {
  key: string;
  size: number;
  etag: string;
}

export interface ObjectStore {
  list(bucket: string, prefix?: string): Promise<StoredObject[]>;
  upload(bucket: string, key: string, filePath: string): Promise<void>;
  download(bucket: string, key: string, filePath: string): Promise<void>;
  copy(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string): Promise<void>;
  remove(bucket: string, keys: string[]): Promise<void>;
}

export interface DatabaseTool {
  dump(databaseUrl: string, outFile: string): Promise<void>;
  restore(dumpFile: string, targetUrl: string): Promise<void>;
}

export interface LocalFiles {
  ensureDir(dir: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  rename(from: string, to: string): Promise<void>;
  remove(filePath: string): Promise<void>;
}
