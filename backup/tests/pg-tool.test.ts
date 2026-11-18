import { PgTool, pgDumpArgs, pgRestoreArgs, runCommand } from "../src/adapters/pg-tool";

const URL = "postgresql://patitas:secreto@postgres:5432/patitas";

describe("argumentos de pg_dump y pg_restore", () => {
  it("pg_dump en formato custom", () => {
    expect(pgDumpArgs(URL, "/backups/db/x.dump.partial")).toEqual([
      "--format=custom",
      "--file=/backups/db/x.dump.partial",
      `--dbname=${URL}`,
    ]);
  });

  it("pg_restore sin owner, con clean e if-exists", () => {
    expect(pgRestoreArgs("/backups/db/x.dump", URL)).toEqual([
      "--no-owner",
      "--clean",
      "--if-exists",
      `--dbname=${URL}`,
      "/backups/db/x.dump",
    ]);
  });
});

describe("runCommand", () => {
  it("resuelve si el proceso termina con código 0", async () => {
    await expect(runCommand(process.execPath, ["-e", "process.exit(0)"])).resolves.toBeUndefined();
  });

  it("rechaza con el stderr y sin exponer los argumentos (llevan la contraseña)", async () => {
    const promise = runCommand(process.execPath, [
      "-e",
      "console.error('fallo de conexión'); process.exit(2)",
      URL,
    ]);
    await expect(promise).rejects.toThrow(/código 2.*fallo de conexión/s);
    await expect(promise).rejects.not.toThrow(/secreto/);
  });

  it("rechaza si el binario no existe", async () => {
    await expect(runCommand("binario-que-no-existe-xyz", [])).rejects.toThrow(/binario-que-no-existe-xyz/);
  });
});

describe("PgTool", () => {
  it("invoca pg_dump y pg_restore con sus argumentos", async () => {
    const calls: [string, string[]][] = [];
    const tool = new PgTool(async (cmd, args) => {
      calls.push([cmd, args]);
    });
    await tool.dump(URL, "/out.dump");
    await tool.restore("/in.dump", URL);
    expect(calls).toEqual([
      ["pg_dump", pgDumpArgs(URL, "/out.dump")],
      ["pg_restore", pgRestoreArgs("/in.dump", URL)],
    ]);
  });
});
