import type { DatabaseTool, LocalFiles, Logger, ObjectStore, StoredObject } from "../src/ports";

// fakes en memoria de los puertos

export class FakeFiles implements LocalFiles {
  readonly files = new Set<string>();
  readonly dirs = new Set<string>();

  async ensureDir(dir: string): Promise<void> {
    this.dirs.add(dir);
  }

  async list(dir: string): Promise<string[]> {
    return [...this.files]
      .filter((file) => file.startsWith(`${dir}/`) && !file.slice(dir.length + 1).includes("/"))
      .map((file) => file.slice(dir.length + 1));
  }

  async rename(from: string, to: string): Promise<void> {
    if (!this.files.delete(from)) throw new Error(`no existe ${from}`);
    this.files.add(to);
  }

  async remove(filePath: string): Promise<void> {
    this.files.delete(filePath);
  }
}

export class FakeDb implements DatabaseTool {
  dumpError: Error | null = null;
  readonly dumps: { databaseUrl: string; outFile: string }[] = [];
  readonly restores: { dumpFile: string; targetUrl: string }[] = [];

  constructor(private readonly files: FakeFiles) {}

  async dump(databaseUrl: string, outFile: string): Promise<void> {
    this.dumps.push({ databaseUrl, outFile });
    // pg_dump deja el archivo a medio escribir aunque falle
    this.files.files.add(outFile);
    if (this.dumpError) throw this.dumpError;
  }

  async restore(dumpFile: string, targetUrl: string): Promise<void> {
    this.restores.push({ dumpFile, targetUrl });
  }
}

export class FakeStore implements ObjectStore {
  readonly buckets = new Map<string, Map<string, StoredObject>>();
  readonly failing = new Set<"list" | "upload" | "download" | "copy" | "remove">();
  readonly failingCopyKeys = new Set<string>();
  readonly downloads: { bucket: string; key: string; filePath: string }[] = [];

  constructor(private readonly files?: FakeFiles) {}

  put(bucket: string, key: string, size = 1, etag = `"${key}"`): void {
    if (!this.buckets.has(bucket)) this.buckets.set(bucket, new Map());
    this.buckets.get(bucket)!.set(key, { key, size, etag });
  }

  keys(bucket: string): string[] {
    return [...(this.buckets.get(bucket)?.keys() ?? [])].sort();
  }

  private check(op: "list" | "upload" | "download" | "copy" | "remove"): void {
    if (this.failing.has(op)) throw new Error(`${op} falló (R2 caído)`);
  }

  async list(bucket: string, prefix = ""): Promise<StoredObject[]> {
    this.check("list");
    return [...(this.buckets.get(bucket)?.values() ?? [])].filter((o) => o.key.startsWith(prefix));
  }

  async upload(bucket: string, key: string): Promise<void> {
    this.check("upload");
    this.put(bucket, key);
  }

  async download(bucket: string, key: string, filePath: string): Promise<void> {
    this.check("download");
    this.downloads.push({ bucket, key, filePath });
    this.files?.files.add(filePath);
  }

  async copy(sourceBucket: string, sourceKey: string, destBucket: string, destKey: string): Promise<void> {
    this.check("copy");
    if (this.failingCopyKeys.has(sourceKey)) throw new Error(`no se pudo copiar ${sourceKey}`);
    const source = this.buckets.get(sourceBucket)?.get(sourceKey);
    if (!source) throw new Error(`no existe ${sourceKey}`);
    this.put(destBucket, destKey, source.size, source.etag);
  }

  async remove(bucket: string, keys: string[]): Promise<void> {
    this.check("remove");
    keys.forEach((key) => this.buckets.get(bucket)?.delete(key));
  }
}

export class MemoryLogger implements Logger {
  readonly infos: string[] = [];
  readonly errors: string[] = [];

  info(message: string): void {
    this.infos.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }
}
