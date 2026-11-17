import path from "path";
import type { BackupConfig } from "./config";
import { dumpFileName } from "./dump-name";
import { IMAGES_PREFIX, selectImagesToCopy } from "./images";
import type { DatabaseTool, LocalFiles, Logger, ObjectStore } from "./ports";
import { planRetention } from "./retention";

export const DB_PREFIX = "db/";

export interface BackupDeps {
  db: DatabaseTool;
  store: ObjectStore;
  files: LocalFiles;
  logger: Logger;
}

export interface StepResult {
  name: "dump" | "local-rotation" | "upload" | "remote-rotation" | "images";
  ok: boolean;
  detail?: string;
}

export interface BackupReport {
  ok: boolean;
  dumpFile?: string;
  steps: StepResult[];
}

// el contenedor es Linux: rutas POSIX aunque los tests corran en Windows
const posix = path.posix;

async function createDump(deps: BackupDeps, config: BackupConfig, now: Date): Promise<string> {
  const dir = posix.join(config.backupDir, "db");
  const finalPath = posix.join(dir, dumpFileName(now));
  const partialPath = `${finalPath}.partial`;
  await deps.files.ensureDir(dir);
  try {
    await deps.db.dump(config.databaseUrl, partialPath);
  } catch (error) {
    await deps.files.remove(partialPath).catch(() => undefined);
    throw error;
  }
  // solo un dump completo lleva el nombre final que ve la rotación
  await deps.files.rename(partialPath, finalPath);
  return finalPath;
}

async function rotateLocal(deps: BackupDeps, config: BackupConfig): Promise<string> {
  const dir = posix.join(config.backupDir, "db");
  const { keep, remove } = planRetention(await deps.files.list(dir));
  for (const name of remove) {
    await deps.files.remove(posix.join(dir, name));
  }
  return `${keep.length} conservados, ${remove.length} borrados`;
}

async function rotateRemote(deps: BackupDeps, config: BackupConfig): Promise<string> {
  const names = (await deps.store.list(config.r2.bucket, DB_PREFIX))
    .map((object) => object.key.slice(DB_PREFIX.length))
    .filter((name) => !name.includes("/"));
  const { keep, remove } = planRetention(names);
  if (remove.length > 0) {
    await deps.store.remove(config.r2.bucket, remove.map((name) => DB_PREFIX + name));
  }
  return `${keep.length} conservados, ${remove.length} borrados`;
}

async function copyImages(deps: BackupDeps, config: BackupConfig): Promise<string> {
  const [source, backup] = await Promise.all([
    deps.store.list(config.sourceImagesBucket),
    deps.store.list(config.r2.bucket, IMAGES_PREFIX),
  ]);
  const pending = selectImagesToCopy(source, backup);
  let failed = 0;
  for (const item of pending) {
    try {
      await deps.store.copy(config.sourceImagesBucket, item.sourceKey, config.r2.bucket, item.destKey);
    } catch (error) {
      failed += 1;
      deps.logger.error(`[images] no se pudo copiar ${item.sourceKey}: ${(error as Error).message}`);
    }
  }
  const detail = `${pending.length - failed} copiadas, ${failed} fallidas, ${source.length} en origen`;
  if (failed > 0) throw new Error(detail);
  return detail;
}

// cada paso es independiente: un fallo se registra y no frena a los demás
export async function runBackup(
  deps: BackupDeps,
  config: BackupConfig,
  now: Date = new Date()
): Promise<BackupReport> {
  const steps: StepResult[] = [];

  const step = async (name: StepResult["name"], action: () => Promise<string>): Promise<boolean> => {
    try {
      const detail = await action();
      steps.push({ name, ok: true, detail });
      deps.logger.info(`[${name}] OK: ${detail}`);
      return true;
    } catch (error) {
      const detail = (error as Error).message;
      steps.push({ name, ok: false, detail });
      deps.logger.error(`[${name}] FALLÓ: ${detail}`);
      return false;
    }
  };

  let dumpFile: string | undefined;
  await step("dump", async () => {
    dumpFile = await createDump(deps, config, now);
    return dumpFile;
  });
  await step("local-rotation", () => rotateLocal(deps, config));
  await step("upload", async () => {
    if (!dumpFile) throw new Error("sin dump para subir (falló el paso dump)");
    const key = DB_PREFIX + posix.basename(dumpFile);
    await deps.store.upload(config.r2.bucket, key, dumpFile);
    return `${config.r2.bucket}/${key}`;
  });
  await step("remote-rotation", () => rotateRemote(deps, config));
  await step("images", () => copyImages(deps, config));

  return { ok: steps.every((result) => result.ok), dumpFile, steps };
}
