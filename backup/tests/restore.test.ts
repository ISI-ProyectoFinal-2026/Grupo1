import { runRestore } from "../src/restore";
import { FakeDb, FakeFiles, FakeStore, MemoryLogger } from "./fakes";

const TARGET = "postgresql://patitas:patitas@localhost:5434/patitas_restore";

function setup() {
  const files = new FakeFiles();
  const db = new FakeDb(files);
  const store = new FakeStore(files);
  const logger = new MemoryLogger();
  return { files, db, store, logger };
}

describe("runRestore", () => {
  it("restaura un archivo local directamente", async () => {
    const { db, files, logger } = setup();
    await runRestore({ db, files, logger }, { source: "/backups/db/x.dump", targetUrl: TARGET, backupDir: "/backups" });
    expect(db.restores).toEqual([{ dumpFile: "/backups/db/x.dump", targetUrl: TARGET }]);
  });

  it("con r2:<clave> baja primero el dump del bucket de backup", async () => {
    const { db, files, store, logger } = setup();
    await runRestore(
      { db, files, logger, store, bucket: "backups" },
      { source: "r2:db/patitas-20261115T060000Z.dump", targetUrl: TARGET, backupDir: "/backups" }
    );
    const local = "/backups/restore/patitas-20261115T060000Z.dump";
    expect(files.dirs).toContain("/backups/restore");
    expect(store.downloads).toEqual([
      { bucket: "backups", key: "db/patitas-20261115T060000Z.dump", filePath: local },
    ]);
    expect(db.restores).toEqual([{ dumpFile: local, targetUrl: TARGET }]);
  });

  it("con r2: y sin acceso a R2 falla con un mensaje claro", async () => {
    const { db, files, logger } = setup();
    await expect(
      runRestore({ db, files, logger }, { source: "r2:db/x.dump", targetUrl: TARGET, backupDir: "/backups" })
    ).rejects.toThrow(/R2/);
    expect(db.restores).toEqual([]);
  });
});
