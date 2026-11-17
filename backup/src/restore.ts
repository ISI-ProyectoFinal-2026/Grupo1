import path from "path";
import type { DatabaseTool, LocalFiles, Logger, ObjectStore } from "./ports";

export const REMOTE_SOURCE_PREFIX = "r2:";

export interface RestoreDeps {
  db: DatabaseTool;
  files: LocalFiles;
  logger: Logger;
  store?: ObjectStore;
  bucket?: string;
}

export interface RestoreOptions {
  source: string;
  targetUrl: string;
  backupDir: string;
}

// source: ruta local o "r2:<clave>" del bucket de backup
export async function runRestore(deps: RestoreDeps, options: RestoreOptions): Promise<void> {
  let dumpFile = options.source;

  if (options.source.startsWith(REMOTE_SOURCE_PREFIX)) {
    if (!deps.store || !deps.bucket) {
      throw new Error("Restaurar desde R2 requiere las variables BACKUP_R2_*");
    }
    const key = options.source.slice(REMOTE_SOURCE_PREFIX.length);
    const dir = path.posix.join(options.backupDir, "restore");
    dumpFile = path.posix.join(dir, path.posix.basename(key));
    await deps.files.ensureDir(dir);
    deps.logger.info(`Descargando ${deps.bucket}/${key} a ${dumpFile}`);
    await deps.store.download(deps.bucket, key, dumpFile);
  }

  deps.logger.info(`Restaurando ${dumpFile} en la base destino`);
  await deps.db.restore(dumpFile, options.targetUrl);
  deps.logger.info("Restauración terminada");
}
