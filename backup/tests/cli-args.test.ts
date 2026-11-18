import { parseCommand } from "../src/cli-args";

describe("parseCommand", () => {
  it("sin argumentos corre el daemon", () => {
    expect(parseCommand([])).toEqual({ command: "daemon" });
  });

  it.each(["daemon", "run-once"])("acepta %s", (command) => {
    expect(parseCommand([command])).toEqual({ command });
  });

  it("restore con --target", () => {
    expect(parseCommand(["restore", "r2:db/x.dump", "--target", "postgresql://h/db"])).toEqual({
      command: "restore",
      source: "r2:db/x.dump",
      targetUrl: "postgresql://h/db",
    });
  });

  it("restore acepta --target=valor y el orden inverso", () => {
    expect(parseCommand(["restore", "--target=postgresql://h/db", "/backups/db/x.dump"])).toEqual({
      command: "restore",
      source: "/backups/db/x.dump",
      targetUrl: "postgresql://h/db",
    });
  });

  it("restore sin --target falla: no hay destino por defecto", () => {
    expect(() => parseCommand(["restore", "x.dump"])).toThrow(/--target/);
  });

  it("restore sin dump falla", () => {
    expect(() => parseCommand(["restore", "--target", "postgresql://h/db"])).toThrow(/dump/);
  });

  it("comando desconocido falla mostrando el uso", () => {
    expect(() => parseCommand(["backup-now"])).toThrow(/Uso/);
  });
});
