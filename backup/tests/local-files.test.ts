import fs from "fs";
import os from "os";
import path from "path";
import { NodeFiles } from "../src/adapters/local-files";

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "local-files-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("NodeFiles", () => {
  it("crea directorios, lista solo archivos, renombra y borra", async () => {
    const files = new NodeFiles();
    const dir = path.join(tmp, "db");
    await files.ensureDir(dir);
    fs.writeFileSync(path.join(dir, "a.partial"), "x");
    fs.mkdirSync(path.join(dir, "sub"));

    await files.rename(path.join(dir, "a.partial"), path.join(dir, "a.dump"));
    expect(await files.list(dir)).toEqual(["a.dump"]);

    await files.remove(path.join(dir, "a.dump"));
    expect(await files.list(dir)).toEqual([]);
  });

  it("borrar un archivo inexistente no falla", async () => {
    await expect(new NodeFiles().remove(path.join(tmp, "nada"))).resolves.toBeUndefined();
  });
});
