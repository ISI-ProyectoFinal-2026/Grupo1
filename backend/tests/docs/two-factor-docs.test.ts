import { readFileSync } from "fs";
import path from "path";

const KEY = "TWO_FACTOR_ENCRYPTION_KEY";
const DOCS = [
  ["backend/README.md", path.resolve(__dirname, "../../README.md")],
  ["docker/ENV_VARS.md", path.resolve(__dirname, "../../../docker/ENV_VARS.md")],
] as const;

describe.each(DOCS)("%s documenta la clave de cifrado del 2FA", (_name, file) => {
  const content = readFileSync(file, "utf8");
  const keyLines = content.split(/\r?\n/).filter((line) => line.includes(KEY));

  test("nombra la variable", () => {
    expect(keyLines.length).toBeGreaterThan(0);
  });

  test("dice que es obligatoria en producción", () => {
    expect(keyLines.some((line) => /obligatori/i.test(line) && /producción/i.test(line))).toBe(true);
  });

  test("explica cómo generarla", () => {
    expect(content).toContain("openssl rand -base64 32");
  });

  test("explica el fallback de desarrollo con JWT_SECRET", () => {
    expect(content).toMatch(/se deriva de `?JWT_SECRET/i);
  });

  test("advierte qué pasa si se pierde o se cambia", () => {
    expect(content).toMatch(/perder|pierde|cambiar la clave|cambia la clave/i);
  });
});
