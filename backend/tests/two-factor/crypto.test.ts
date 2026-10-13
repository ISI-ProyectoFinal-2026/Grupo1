import { AppError } from "../../src/errors/app-error";
import {
  assertTwoFactorConfigured,
  decryptSecret,
  encryptSecret,
  resolveTwoFactorKey,
} from "../../src/services/two-factor/crypto";

const HEX_KEY = "a1".repeat(32);
const BASE64_KEY = Buffer.from("b2".repeat(32), "hex").toString("base64");

function expectNotConfigured(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    const appError = error as AppError;
    expect(appError.statusCode).toBe(503);
    expect(appError.code).toBe("TWO_FACTOR_NOT_CONFIGURED");
    expect(appError.message).toContain("TWO_FACTOR_ENCRYPTION_KEY");
    expect(appError.details).toEqual({ missingEnvVars: ["TWO_FACTOR_ENCRYPTION_KEY"] });
    return appError;
  }
  throw new Error("Se esperaba un AppError 503 y no se lanzó nada");
}

describe("crypto — resolveTwoFactorKey()", () => {
  test("acepta 64 caracteres hex", () => {
    const key = resolveTwoFactorKey({ NODE_ENV: "production", TWO_FACTOR_ENCRYPTION_KEY: HEX_KEY });
    expect(key).toHaveLength(32);
    expect(key.toString("hex")).toBe(HEX_KEY);
  });

  test("acepta base64 de 32 bytes", () => {
    const key = resolveTwoFactorKey({ NODE_ENV: "production", TWO_FACTOR_ENCRYPTION_KEY: BASE64_KEY });
    expect(key).toHaveLength(32);
    expect(key.toString("hex")).toBe("b2".repeat(32));
  });

  test("en producción sin clave responde 503 nombrando la variable", () => {
    expectNotConfigured(() => resolveTwoFactorKey({ NODE_ENV: "production", JWT_SECRET: "x" }));
  });

  test("en producción una clave vacía cuenta como ausente", () => {
    expectNotConfigured(() =>
      resolveTwoFactorKey({ NODE_ENV: "production", JWT_SECRET: "x", TWO_FACTOR_ENCRYPTION_KEY: "  " })
    );
  });

  test("en producción una clave inválida responde 503 (corta, hex inválido, base64 de otro largo)", () => {
    for (const bad of ["abc123", "zz".repeat(32), Buffer.alloc(16, 1).toString("base64"), Buffer.alloc(33, 1).toString("base64")]) {
      expectNotConfigured(() => resolveTwoFactorKey({ NODE_ENV: "production", TWO_FACTOR_ENCRYPTION_KEY: bad }));
    }
  });

  test("fuera de producción una clave inválida también responde 503", () => {
    expectNotConfigured(() => resolveTwoFactorKey({ NODE_ENV: "development", TWO_FACTOR_ENCRYPTION_KEY: "abc123" }));
  });

  test("fuera de producción sin clave se deriva de JWT_SECRET (HKDF, 32 bytes, determinista)", () => {
    const a = resolveTwoFactorKey({ NODE_ENV: "test", JWT_SECRET: "secreto-uno" });
    const again = resolveTwoFactorKey({ NODE_ENV: "development", JWT_SECRET: "secreto-uno" });
    const other = resolveTwoFactorKey({ NODE_ENV: "test", JWT_SECRET: "secreto-dos" });

    expect(a).toHaveLength(32);
    expect(a.equals(again)).toBe(true);
    expect(a.equals(other)).toBe(false);
  });

  test("la clave explícita tiene prioridad sobre la derivación fuera de producción", () => {
    const key = resolveTwoFactorKey({ NODE_ENV: "test", JWT_SECRET: "x", TWO_FACTOR_ENCRYPTION_KEY: HEX_KEY });
    expect(key.toString("hex")).toBe(HEX_KEY);
  });

  test("fuera de producción sin clave ni JWT_SECRET responde 503", () => {
    expectNotConfigured(() => resolveTwoFactorKey({ NODE_ENV: "test" }));
  });
});

describe("crypto — assertTwoFactorConfigured()", () => {
  test("no tira cuando hay clave resoluble", () => {
    expect(() => assertTwoFactorConfigured({ NODE_ENV: "production", TWO_FACTOR_ENCRYPTION_KEY: HEX_KEY })).not.toThrow();
    expect(() => assertTwoFactorConfigured({ NODE_ENV: "test", JWT_SECRET: "x" })).not.toThrow();
  });

  test("tira 503 cuando falta en producción", () => {
    expectNotConfigured(() => assertTwoFactorConfigured({ NODE_ENV: "production" }));
  });
});

describe("crypto — encryptSecret() / decryptSecret()", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = original.JWT_SECRET ?? "jwt-de-prueba";
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = { ...original };
  });

  test("ida y vuelta devuelve el secreto original", () => {
    const payload = encryptSecret("JBSWY3DPEHPK3PXP", 7);
    expect(decryptSecret(payload, 7)).toBe("JBSWY3DPEHPK3PXP");
  });

  test("tiene formato v1.iv.tag.ct en base64url y no contiene el texto plano", () => {
    const payload = encryptSecret("JBSWY3DPEHPK3PXP", 7);
    expect(payload).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$/);
    expect(payload).not.toContain("JBSWY3DPEHPK3PXP");
  });

  test("el IV es aleatorio: el mismo texto da cifrados distintos", () => {
    expect(encryptSecret("JBSWY3DPEHPK3PXP", 7)).not.toBe(encryptSecret("JBSWY3DPEHPK3PXP", 7));
  });

  test("falla si se descifra con otro usuario (el cifrado queda atado al dueño)", () => {
    const payload = encryptSecret("JBSWY3DPEHPK3PXP", 7);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    expectNotConfigured(() => decryptSecret(payload, 8));
  });

  test("falla si se altera el texto cifrado, el tag o el IV", () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const [version, iv, tag, ct] = encryptSecret("JBSWY3DPEHPK3PXP", 7).split(".");
    const flip = (value: string) => `${value[0] === "A" ? "B" : "A"}${value.slice(1)}`;

    expectNotConfigured(() => decryptSecret([version, iv, tag, flip(ct)].join("."), 7));
    expectNotConfigured(() => decryptSecret([version, iv, flip(tag), ct].join("."), 7));
    expectNotConfigured(() => decryptSecret([version, flip(iv), tag, ct].join("."), 7));
  });

  test("falla con una versión desconocida o un formato mal armado", () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const payload = encryptSecret("JBSWY3DPEHPK3PXP", 7);

    expectNotConfigured(() => decryptSecret(payload.replace(/^v1/, "v2"), 7));
    expectNotConfigured(() => decryptSecret("basura", 7));
    expectNotConfigured(() => decryptSecret("", 7));
  });

  test("un fallo de descifrado deja registro en console.error", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expectNotConfigured(() => decryptSecret("basura", 7));
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  test("cambiar la clave impide descifrar lo cifrado antes", () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.TWO_FACTOR_ENCRYPTION_KEY = HEX_KEY;
    const payload = encryptSecret("JBSWY3DPEHPK3PXP", 7);
    expect(decryptSecret(payload, 7)).toBe("JBSWY3DPEHPK3PXP");

    process.env.TWO_FACTOR_ENCRYPTION_KEY = "c3".repeat(32);
    expectNotConfigured(() => decryptSecret(payload, 7));
  });

  test("en producción sin clave cifrar responde 503", () => {
    process.env.NODE_ENV = "production";
    expectNotConfigured(() => encryptSecret("JBSWY3DPEHPK3PXP", 7));
  });
});
