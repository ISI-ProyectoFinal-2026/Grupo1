import { runBackup } from "../src/backup-job";
import type { BackupConfig } from "../src/config";
import { dumpFileName } from "../src/dump-name";
import { FakeDb, FakeFiles, FakeStore, MemoryLogger } from "./fakes";

const NOW = new Date("2026-11-15T06:00:00Z");
const NAME = "patitas-20261115T060000Z.dump";

const config: BackupConfig = {
  databaseUrl: "postgresql://patitas:patitas@postgres:5432/patitas",
  backupDir: "/backups",
  backupHour: 3,
  sourceImagesBucket: "imagenes",
  r2: { endpoint: "https://r2", accessKeyId: "k", secretAccessKey: "s", bucket: "backups" },
};

function setup() {
  const files = new FakeFiles();
  const db = new FakeDb(files);
  const store = new FakeStore();
  const logger = new MemoryLogger();
  return { files, db, store, logger, deps: { db, store, files, logger } };
}

function oldDumps(count: number): string[] {
  // un dump diario los días anteriores a NOW
  return Array.from({ length: count }, (_, i) =>
    dumpFileName(new Date(NOW.getTime() - (i + 1) * 86400000))
  );
}

describe("runBackup", () => {
  it("genera el dump con nombre UTC y lo deja en /backups/db", async () => {
    const { deps, db, files } = setup();
    const report = await runBackup(deps, config, NOW);

    expect(db.dumps).toEqual([
      { databaseUrl: config.databaseUrl, outFile: `/backups/db/${NAME}.partial` },
    ]);
    expect(files.dirs).toContain("/backups/db");
    expect(files.files).toEqual(new Set([`/backups/db/${NAME}`]));
    expect(report.ok).toBe(true);
    expect(report.dumpFile).toBe(`/backups/db/${NAME}`);
  });

  it("sube el dump al bucket de backup bajo db/", async () => {
    const { deps, store } = setup();
    await runBackup(deps, config, NOW);
    expect(store.keys("backups")).toEqual([`db/${NAME}`]);
  });

  it("rota los dumps locales con la política 7 diarios + 4 semanales", async () => {
    const { deps, files } = setup();
    oldDumps(30).forEach((name) => files.files.add(`/backups/db/${name}`));
    files.files.add("/backups/db/nota.txt");

    await runBackup(deps, config, NOW);

    const remaining = await files.list("/backups/db");
    // 7 diarios (15/11 a 09/11) + domingos 08/11, 01/11 y 25/10 de las semanas anteriores
    expect(remaining.filter((name) => name.endsWith(".dump"))).toHaveLength(10);
    expect(remaining).toContain("nota.txt");
  });

  it("aplica la misma retención en R2 y no toca claves fuera de db/", async () => {
    const { deps, store } = setup();
    oldDumps(30).forEach((name) => store.put("backups", `db/${name}`));
    store.put("backups", "images/pets/a.jpg");

    await runBackup(deps, config, NOW);

    const keys = store.keys("backups");
    expect(keys.filter((key) => key.startsWith("db/"))).toHaveLength(10);
    expect(keys).toContain(`db/${NAME}`);
    expect(keys).toContain("images/pets/a.jpg");
  });

  it("copia incrementalmente las imágenes a images/ sin borrar nada", async () => {
    const { deps, store } = setup();
    store.put("imagenes", "pets/nueva.jpg", 5);
    store.put("imagenes", "pets/igual.jpg", 5);
    store.put("backups", "images/pets/igual.jpg", 5, `"pets/igual.jpg"`);
    store.put("backups", "images/pets/borrada-en-origen.jpg", 5);
    const copySpy = jest.spyOn(store, "copy");

    const report = await runBackup(deps, config, NOW);

    expect(copySpy).toHaveBeenCalledTimes(1);
    expect(copySpy).toHaveBeenCalledWith("imagenes", "pets/nueva.jpg", "backups", "images/pets/nueva.jpg");
    expect(store.keys("backups")).toContain("images/pets/borrada-en-origen.jpg");
    expect(report.steps.find((step) => step.name === "images")?.detail).toContain("1 copiadas");
  });

  it("si falla la subida, conserva el dump local, lo registra y sigue con las imágenes", async () => {
    const { deps, store, files, logger } = setup();
    store.failing.add("upload");
    store.put("imagenes", "pets/a.jpg");

    const report = await runBackup(deps, config, NOW);

    expect(files.files).toContain(`/backups/db/${NAME}`);
    expect(report.ok).toBe(false);
    expect(report.steps.find((step) => step.name === "upload")).toMatchObject({ ok: false });
    expect(logger.errors.join("\n")).toMatch(/upload.*R2 caído/);
    expect(store.keys("backups")).toContain("images/pets/a.jpg");
  });

  it("si R2 está caído, el dump local y su rotación se completan igual", async () => {
    const { deps, store, files } = setup();
    ["list", "upload", "copy", "remove"].forEach((op) => store.failing.add(op as "list"));
    oldDumps(20).forEach((name) => files.files.add(`/backups/db/${name}`));

    const report = await runBackup(deps, config, NOW);

    expect(files.files).toContain(`/backups/db/${NAME}`);
    expect(report.steps.filter((step) => step.ok).map((step) => step.name)).toEqual([
      "dump",
      "local-rotation",
    ]);
  });

  it("si pg_dump falla, borra el parcial, no sube nada y no rompe", async () => {
    const { deps, db, files, store, logger } = setup();
    db.dumpError = new Error("pg_dump: connection refused");

    const report = await runBackup(deps, config, NOW);

    expect(files.files.size).toBe(0);
    expect(store.keys("backups")).toEqual([]);
    expect(report.ok).toBe(false);
    expect(report.dumpFile).toBeUndefined();
    expect(report.steps.find((step) => step.name === "upload")).toMatchObject({
      ok: false,
      detail: expect.stringContaining("sin dump"),
    });
    expect(logger.errors.join("\n")).toContain("connection refused");
  });

  it("si falla la copia de una imagen, copia el resto y marca el paso como fallido", async () => {
    const { deps, store } = setup();
    store.put("imagenes", "pets/a.jpg");
    store.put("imagenes", "pets/b.jpg");
    store.failingCopyKeys.add("pets/a.jpg");

    const report = await runBackup(deps, config, NOW);

    expect(store.keys("backups")).toContain("images/pets/b.jpg");
    expect(report.steps.find((step) => step.name === "images")).toMatchObject({
      ok: false,
      detail: expect.stringContaining("1 fallidas"),
    });
  });
});
