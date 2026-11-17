import { ConfigError, loadBackupConfig, loadR2Config } from "../src/config";

const FULL_ENV = {
  DATABASE_URL: "postgresql://patitas:patitas@postgres:5432/patitas",
  BACKUP_R2_ENDPOINT: "https://acc.r2.cloudflarestorage.com",
  BACKUP_R2_ACCESS_KEY_ID: "key",
  BACKUP_R2_SECRET_ACCESS_KEY: "secret",
  BACKUP_R2_BUCKET: "patitas-backups",
  SOURCE_IMAGES_BUCKET: "patitas-images",
};

describe("loadBackupConfig", () => {
  it("arma la configuración con defaults", () => {
    expect(loadBackupConfig(FULL_ENV)).toEqual({
      databaseUrl: FULL_ENV.DATABASE_URL,
      backupDir: "/backups",
      backupHour: 3,
      sourceImagesBucket: "patitas-images",
      r2: {
        endpoint: FULL_ENV.BACKUP_R2_ENDPOINT,
        accessKeyId: "key",
        secretAccessKey: "secret",
        bucket: "patitas-backups",
      },
    });
  });

  it("respeta BACKUP_HOUR y BACKUP_DIR", () => {
    const config = loadBackupConfig({ ...FULL_ENV, BACKUP_HOUR: "23", BACKUP_DIR: "/data" });
    expect(config.backupHour).toBe(23);
    expect(config.backupDir).toBe("/data");
  });

  it("lista todas las variables faltantes en el error", () => {
    const env = { ...FULL_ENV, DATABASE_URL: "", BACKUP_R2_BUCKET: undefined };
    expect(() => loadBackupConfig(env)).toThrow(ConfigError);
    try {
      loadBackupConfig(env);
    } catch (error) {
      expect((error as ConfigError).missing).toEqual(["DATABASE_URL", "BACKUP_R2_BUCKET"]);
      expect((error as Error).message).toContain("DATABASE_URL, BACKUP_R2_BUCKET");
    }
  });

  it.each(["24", "-1", "3.5", "tres"])("rechaza BACKUP_HOUR=%s", (hour) => {
    expect(() => loadBackupConfig({ ...FULL_ENV, BACKUP_HOUR: hour })).toThrow(/BACKUP_HOUR/);
  });
});

describe("loadR2Config", () => {
  it("solo exige las variables de R2", () => {
    const { DATABASE_URL, SOURCE_IMAGES_BUCKET, ...r2Only } = FULL_ENV;
    expect(loadR2Config(r2Only).bucket).toBe("patitas-backups");
  });

  it("falla listando las de R2 que faltan", () => {
    expect(() => loadR2Config({})).toThrow(
      /BACKUP_R2_ENDPOINT, BACKUP_R2_ACCESS_KEY_ID, BACKUP_R2_SECRET_ACCESS_KEY, BACKUP_R2_BUCKET/
    );
  });
});
