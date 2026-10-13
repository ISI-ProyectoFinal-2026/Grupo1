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

  test("ofrece el reinicio por autoservicio de 72 h para quien perdió el dispositivo o la clave", () => {
    const lostAccess = content.split(/\r?\n/).filter((line) => /reinicio/i.test(line) && /72 ?h/i.test(line));

    expect(lostAccess.length).toBeGreaterThan(0);
    expect(content).toMatch(/no necesita la clave|sin la clave/i);
  });
});

describe("docs/ARQUITECTURA.md documenta el 2FA", () => {
  const content = readFileSync(path.resolve(__dirname, "../../../docs/ARQUITECTURA.md"), "utf8");
  const section = content.split(/\r?\n(?=#{2,4} )/).find((block) => /^#{2,4} Segundo factor/.test(block)) ?? "";

  test("tiene una sección propia sobre el segundo factor", () => {
    expect(section.length).toBeGreaterThan(0);
  });

  test("describe el desafío del login: opaco, de 5 minutos y que no es una sesión", () => {
    expect(section).toMatch(/desafío/i);
    expect(section).toMatch(/5 minutos/);
    expect(section).toMatch(/no es (un JWT|una sesión)/i);
  });

  test("describe el bloqueo: 5 fallos, 15 minutos, contador compartido en la base", () => {
    expect(section).toMatch(/5 (intentos )?fallos|5 fallidos|cinco/i);
    expect(section).toMatch(/15 minutos/);
    expect(section).toMatch(/compartid/i);
  });

  test("describe el reinicio demorado: 72 h, cancelación y finalización perezosa sin cron", () => {
    expect(section).toMatch(/72 ?h/i);
    expect(section).toMatch(/cancel/i);
    expect(section).toMatch(/al iniciar sesión|en el login/i);
    expect(section).toMatch(/sin cron|no hay cron|no usa cron/i);
  });

  test("deja asentada la limitación aceptada: quien tiene la contraseña puede bloquear el segundo paso", () => {
    expect(section).toMatch(/bloquear/i);
    expect(section).toMatch(/limitación|aceptad/i);
  });

  test("lista los endpoints de reinicio y de login de segundo factor", () => {
    for (const endpoint of ["/api/auth/2fa/login", "/api/auth/2fa/reset/request", "/api/auth/2fa/reset/confirm", "/api/auth/2fa/reset/cancel"]) {
      expect(content).toContain(endpoint);
    }
  });

  test("el esquema incluye las columnas del 2FA y los tipos de token nuevos", () => {
    for (const name of ["two_factor_reset_requested_at", "two_factor_login", "two_factor_reset_cancel", "two_factor_recovery_codes"]) {
      expect(content).toContain(name);
    }
  });
});
