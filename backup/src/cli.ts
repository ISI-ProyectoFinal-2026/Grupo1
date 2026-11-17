import { NodeFiles } from "./adapters/local-files";
import { PgTool } from "./adapters/pg-tool";
import { createR2Client, S3ObjectStore } from "./adapters/s3-store";
import { runBackup } from "./backup-job";
import { parseCommand } from "./cli-args";
import { DEFAULT_BACKUP_DIR, loadBackupConfig, loadR2Config, type BackupConfig } from "./config";
import type { Logger } from "./ports";
import { REMOTE_SOURCE_PREFIX, runRestore } from "./restore";
import { startDailySchedule } from "./schedule";

// logger de consola con timestamp
const logger: Logger = {
  info: (message) => console.log(`${new Date().toISOString()} INFO  ${message}`),
  error: (message) => console.error(`${new Date().toISOString()} ERROR ${message}`),
};

function backupDeps(config: BackupConfig) {
  return {
    db: new PgTool(),
    store: new S3ObjectStore(createR2Client(config.r2)),
    files: new NodeFiles(),
    logger,
  };
}

async function backupOnce(config: BackupConfig): Promise<boolean> {
  logger.info("Iniciando backup");
  const report = await runBackup(backupDeps(config), config);
  logger.info(report.ok ? "Backup completo" : "Backup terminado con pasos fallidos");
  return report.ok;
}

async function main(): Promise<number> {
  const command = parseCommand(process.argv.slice(2));

  if (command.command === "run-once") {
    return (await backupOnce(loadBackupConfig(process.env))) ? 0 : 1;
  }

  if (command.command === "restore") {
    const remote = command.source.startsWith(REMOTE_SOURCE_PREFIX);
    const r2 = remote ? loadR2Config(process.env) : undefined;
    await runRestore(
      {
        db: new PgTool(),
        files: new NodeFiles(),
        logger,
        store: r2 ? new S3ObjectStore(createR2Client(r2)) : undefined,
        bucket: r2?.bucket,
      },
      {
        source: command.source,
        targetUrl: command.targetUrl,
        backupDir: process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR,
      }
    );
    return 0;
  }

  // daemon: valida la configuración al arrancar y queda programado
  const config = loadBackupConfig(process.env);
  logger.info(`Servicio de backup iniciado (hora diaria: ${config.backupHour}:00, TZ=${process.env.TZ || "la del sistema"})`);
  const stop = startDailySchedule(async () => {
    await backupOnce(config);
  }, config.backupHour, logger);
  const shutdown = (): void => {
    logger.info("Deteniendo el servicio de backup");
    stop();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return new Promise<number>(() => undefined);
}

main()
  .then((code) => process.exit(code))
  .catch((error: Error) => {
    logger.error(error.message);
    process.exit(1);
  });
