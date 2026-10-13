import {
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  currentStep,
  generateTotpSecret,
  matchTotpStep,
  totpAt,
} from "../../src/services/two-factor/totp";
import { twoFactorClock } from "../../src/services/two-factor/clock";

// Secreto de prueba del RFC 6238 (ASCII "12345678901234567890") en base32.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

// Valores publicados en el apéndice B del RFC 6238 (SHA1); el RFC lista 8
// dígitos y acá se usan los 6 últimos.
const RFC_VECTORS: Array<[number, string]> = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

describe("totp — vectores del RFC 6238", () => {
  test.each(RFC_VECTORS)("en el segundo %i el código es %s", (seconds, expected) => {
    const step = currentStep(seconds * 1000);
    expect(totpAt(RFC_SECRET, step)).toBe(expected);
  });

  test("currentStep usa pasos de 30 segundos", () => {
    expect(currentStep(29_999)).toBe(0);
    expect(currentStep(30_000)).toBe(1);
    expect(currentStep(59_000)).toBe(1);
  });
});

describe("totp — base32", () => {
  test("decodifica el secreto del RFC a su ASCII", () => {
    expect(base32Decode(RFC_SECRET).toString("ascii")).toBe("12345678901234567890");
  });

  test("ida y vuelta con distintos largos", () => {
    for (const hex of ["00", "ff00", "deadbeef", "0102030405060708090a"]) {
      const bytes = Buffer.from(hex, "hex");
      expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
    }
  });

  test("rechaza caracteres fuera del alfabeto", () => {
    expect(() => base32Decode("ABC1")).toThrow();
  });
});

describe("totp — generateTotpSecret()", () => {
  test("genera 160 bits en base32 (32 caracteres) y distintos cada vez", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(a)).toHaveLength(20);
    expect(a).not.toBe(b);
  });
});

describe("totp — matchTotpStep()", () => {
  const nowMs = 1111111109 * 1000;
  const step = currentStep(nowMs);

  test("acepta el paso actual y devuelve su número", () => {
    expect(matchTotpStep(RFC_SECRET, totpAt(RFC_SECRET, step), { nowMs, lastStep: null })).toBe(step);
  });

  test("acepta el paso anterior y el siguiente", () => {
    expect(matchTotpStep(RFC_SECRET, totpAt(RFC_SECRET, step - 1), { nowMs, lastStep: null })).toBe(step - 1);
    expect(matchTotpStep(RFC_SECRET, totpAt(RFC_SECRET, step + 1), { nowMs, lastStep: null })).toBe(step + 1);
  });

  test("rechaza dos pasos de diferencia en ambos sentidos", () => {
    expect(matchTotpStep(RFC_SECRET, totpAt(RFC_SECRET, step - 2), { nowMs, lastStep: null })).toBeNull();
    expect(matchTotpStep(RFC_SECRET, totpAt(RFC_SECRET, step + 2), { nowMs, lastStep: null })).toBeNull();
  });

  test("rechaza un paso menor o igual al último aceptado (replay)", () => {
    const code = totpAt(RFC_SECRET, step);
    expect(matchTotpStep(RFC_SECRET, code, { nowMs, lastStep: step })).toBeNull();
    expect(matchTotpStep(RFC_SECRET, code, { nowMs, lastStep: step + 1 })).toBeNull();
    expect(matchTotpStep(RFC_SECRET, code, { nowMs, lastStep: step - 1 })).toBe(step);
  });

  test("con el último paso aceptado el siguiente de la ventana sigue sirviendo", () => {
    const next = totpAt(RFC_SECRET, step + 1);
    expect(matchTotpStep(RFC_SECRET, next, { nowMs, lastStep: step })).toBe(step + 1);
  });

  test("rechaza entradas que no son exactamente 6 dígitos", () => {
    const code = totpAt(RFC_SECRET, step);
    for (const bad of ["", "12345", "1234567", `${code} `, ` ${code}`, "abcdef", "12 456", `${code}\n`]) {
      expect(matchTotpStep(RFC_SECRET, bad, { nowMs, lastStep: null })).toBeNull();
    }
  });

  test("un código de otro secreto no sirve", () => {
    const other = generateTotpSecret();
    expect(matchTotpStep(RFC_SECRET, totpAt(other, step), { nowMs, lastStep: null })).toBeNull();
  });
});

describe("totp — buildOtpauthUri()", () => {
  test("incluye emisor PATITAS, cuenta, SHA1, 6 dígitos y 30 segundos", () => {
    const uri = new URL(buildOtpauthUri(RFC_SECRET, "ana+test@example.com"));

    expect(uri.protocol).toBe("otpauth:");
    expect(uri.host).toBe("totp");
    expect(decodeURIComponent(uri.pathname)).toBe("/PATITAS:ana+test@example.com");
    expect(uri.searchParams.get("secret")).toBe(RFC_SECRET);
    expect(uri.searchParams.get("issuer")).toBe("PATITAS");
    expect(uri.searchParams.get("algorithm")).toBe("SHA1");
    expect(uri.searchParams.get("digits")).toBe("6");
    expect(uri.searchParams.get("period")).toBe("30");
  });
});

describe("clock — twoFactorClock", () => {
  test("now() devuelve la hora del servidor en milisegundos", () => {
    const before = Date.now();
    const value = twoFactorClock.now();
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(Date.now());
  });

  test("se puede reemplazar con un spy para fijar la hora", () => {
    const spy = jest.spyOn(twoFactorClock, "now").mockReturnValue(59_000);
    try {
      expect(currentStep(twoFactorClock.now())).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});
