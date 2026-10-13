import { AppError } from "../../src/errors/app-error";
import { prisma } from "../../src/db/client";
import { twoFactorClock } from "../../src/services/two-factor/clock";
import * as totp from "../../src/services/two-factor/totp";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifySecondFactor,
} from "../../src/services/two-factor/verify";
import { codeFor, seedTwoFactor, wrongCodeFor } from "../helpers/two-factor";
import { createTestUser } from "../helpers/users";

const ENABLED = { state: "enabled", allowRecovery: true, countFailures: true } as const;
const TOTP_ONLY = { state: "enabled", allowRecovery: false, countFailures: true } as const;
const ENABLE_STEP = { state: "pending", allowRecovery: false, countFailures: false } as const;

// Un instante fijo (mitad de un paso) para que los códigos no dependan de cuándo corre el test.
const BASE_NOW = 1_800_000_000_000 + 10_000;

const createdIds: number[] = [];

async function newUser(prefix = "verify") {
  const { user } = await createTestUser({ prefix });
  createdIds.push(user.id);
  return user;
}

async function readUser(id: number) {
  return prisma.user.findUniqueOrThrow({ where: { id } });
}

async function expectAppError(promise: Promise<unknown>, status: number, code: string): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    const appError = error as AppError;
    expect({ status: appError.statusCode, code: appError.code }).toEqual({ status, code });
    return appError;
  }
  throw new Error(`Se esperaba un AppError ${status} ${code} y no se lanzó nada`);
}

const ok = async () => "listo";

beforeEach(() => {
  jest.spyOn(twoFactorClock, "now").mockReturnValue(BASE_NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe("recovery codes — helpers", () => {
  test("generateRecoveryCodes devuelve N códigos únicos con formato XXXXX-XXXXX", () => {
    const codes = generateRecoveryCodes(10);

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
    }
  });

  test("normalizeRecoveryCode ignora mayúsculas, guiones y espacios", () => {
    expect(normalizeRecoveryCode("abcde-fghij")).toBe("ABCDEFGHIJ");
    expect(normalizeRecoveryCode("  abcde fghij\n")).toBe("ABCDEFGHIJ");
    expect(normalizeRecoveryCode("ABCDEFGHIJ")).toBe("ABCDEFGHIJ");
  });

  test("hashRecoveryCode es sha256 hex del código normalizado", () => {
    expect(hashRecoveryCode("ABCDE-FGHIJ")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRecoveryCode("abcde-fghij")).toBe(hashRecoveryCode("ABCDEFGHIJ"));
    expect(hashRecoveryCode("ABCDE-FGHIK")).not.toBe(hashRecoveryCode("ABCDE-FGHIJ"));
  });
});

describe("verifySecondFactor() — estado de la cuenta", () => {
  test("state enabled sin 2FA activo responde 409 TWO_FACTOR_NOT_ENABLED", async () => {
    const user = await newUser();
    await expectAppError(verifySecondFactor(user.id, "123456", ENABLED, ok), 409, "TWO_FACTOR_NOT_ENABLED");

    const pending = await newUser();
    await seedTwoFactor(pending.id, { enabled: false });
    await expectAppError(verifySecondFactor(pending.id, "123456", ENABLED, ok), 409, "TWO_FACTOR_NOT_ENABLED");
  });

  test("state pending sin alta responde 409 TWO_FACTOR_NOT_SETUP y con 2FA activo 409 TWO_FACTOR_ALREADY_ENABLED", async () => {
    const user = await newUser();
    await expectAppError(verifySecondFactor(user.id, "123456", ENABLE_STEP, ok), 409, "TWO_FACTOR_NOT_SETUP");

    const enabled = await newUser();
    await seedTwoFactor(enabled.id);
    await expectAppError(verifySecondFactor(enabled.id, "123456", ENABLE_STEP, ok), 409, "TWO_FACTOR_ALREADY_ENABLED");
  });

  test("un usuario inexistente responde 404", async () => {
    await expectAppError(verifySecondFactor(2_000_000_000, "123456", ENABLED, ok), 404, "USER_NOT_FOUND");
  });
});

describe("verifySecondFactor() — código TOTP", () => {
  test("un código válido ejecuta onSuccess con el método y devuelve su resultado", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id);
    const onSuccess = jest.fn(async () => "resultado");

    const result = await verifySecondFactor(user.id, codeFor(secret), ENABLED, onSuccess);

    expect(result).toBe("resultado");
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(expect.anything(), {
      method: "totp",
      secretEnc: expect.any(String),
    });
  });

  test("registra el paso aceptado y rechaza el mismo código después (replay)", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id);
    const code = codeFor(secret);

    await verifySecondFactor(user.id, code, ENABLED, ok);
    expect((await readUser(user.id)).twoFactorLastStep).toBe(totp.currentStep(BASE_NOW));

    await expectAppError(verifySecondFactor(user.id, code, ENABLED, ok), 400, "INVALID_TWO_FACTOR_CODE");
  });

  test("después de aceptar un paso, el siguiente de la ventana sirve y uno anterior no", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id);

    await verifySecondFactor(user.id, codeFor(secret), ENABLED, ok);
    await verifySecondFactor(user.id, codeFor(secret, 1), ENABLED, ok);
    await expectAppError(verifySecondFactor(user.id, codeFor(secret, -1), ENABLED, ok), 400, "INVALID_TWO_FACTOR_CODE");
    expect((await readUser(user.id)).twoFactorLastStep).toBe(totp.currentStep(BASE_NOW) + 1);
  });

  test("un código viejo (dos pasos atrás) o ajeno se rechaza con 400", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id);

    await expectAppError(verifySecondFactor(user.id, codeFor(secret, -2), ENABLED, ok), 400, "INVALID_TWO_FACTOR_CODE");
    await expectAppError(verifySecondFactor(user.id, wrongCodeFor(secret), ENABLED, ok), 400, "INVALID_TWO_FACTOR_CODE");
  });

  test("con state pending valida contra el secreto pendiente y registra el paso", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id, { enabled: false });

    const result = await verifySecondFactor(user.id, codeFor(secret), ENABLE_STEP, ok);

    expect(result).toBe("listo");
    const row = await readUser(user.id);
    expect(row.twoFactorLastStep).toBe(totp.currentStep(BASE_NOW));
    expect(row.twoFactorEnabledAt).toBeNull();
  });

  test("si onSuccess falla se deshace todo: el paso no queda consumido", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id);
    const code = codeFor(secret);

    await expect(
      verifySecondFactor(user.id, code, ENABLED, async () => {
        throw new Error("falló el efecto");
      })
    ).rejects.toThrow("falló el efecto");

    expect((await readUser(user.id)).twoFactorLastStep).toBeNull();
    await expect(verifySecondFactor(user.id, code, ENABLED, ok)).resolves.toBe("listo");
  });
});

describe("verifySecondFactor() — bloqueo (A11)", () => {
  test("el 5to fallo bloquea 15 minutos: los 4 primeros dan 400 y el 5to 429 con 900 s", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id);
    const wrong = wrongCodeFor(secret);

    for (let attempt = 1; attempt <= 4; attempt++) {
      await expectAppError(verifySecondFactor(user.id, wrong, ENABLED, ok), 400, "INVALID_TWO_FACTOR_CODE");
      expect((await readUser(user.id)).twoFactorFailedAttempts).toBe(attempt);
    }

    const locked = await expectAppError(verifySecondFactor(user.id, wrong, ENABLED, ok), 429, "TWO_FACTOR_LOCKED");
    expect(locked.details).toEqual({ retryAfterSeconds: 900 });

    const row = await readUser(user.id);
    expect(row.twoFactorFailedAttempts).toBe(5);
    expect(row.twoFactorLockedUntil).toBeInstanceOf(Date);
    const secondsToUnlock = (row.twoFactorLockedUntil!.getTime() - Date.now()) / 1000;
    expect(secondsToUnlock).toBeGreaterThan(880);
    expect(secondsToUnlock).toBeLessThanOrEqual(901);
  });

  test("bloqueado rechaza hasta un código válido y no cambia el contador ni el bloqueo", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id, {
      failedAttempts: 5,
      lockedUntil: new Date(Date.now() + 600_000),
    });
    const before = await readUser(user.id);

    const error = await expectAppError(verifySecondFactor(user.id, codeFor(secret), ENABLED, ok), 429, "TWO_FACTOR_LOCKED");

    const retryAfter = (error.details as { retryAfterSeconds: number }).retryAfterSeconds;
    expect(retryAfter).toBeGreaterThan(590);
    expect(retryAfter).toBeLessThanOrEqual(600);
    await expectAppError(verifySecondFactor(user.id, wrongCodeFor(secret), ENABLED, ok), 429, "TWO_FACTOR_LOCKED");
    const after = await readUser(user.id);
    expect(after.twoFactorFailedAttempts).toBe(before.twoFactorFailedAttempts);
    expect(after.twoFactorLockedUntil).toEqual(before.twoFactorLockedUntil);
    expect(after.twoFactorLastStep).toBeNull();
  });

  test("con el bloqueo vencido un fallo reinicia el contador en 1", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id, {
      failedAttempts: 5,
      lockedUntil: new Date(Date.now() - 1000),
    });

    await expectAppError(verifySecondFactor(user.id, wrongCodeFor(secret), ENABLED, ok), 400, "INVALID_TWO_FACTOR_CODE");

    const row = await readUser(user.id);
    expect(row.twoFactorFailedAttempts).toBe(1);
    expect(row.twoFactorLockedUntil).toBeNull();
  });

  test("con el bloqueo vencido un código válido entra y deja el contador en 0", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id, {
      failedAttempts: 5,
      lockedUntil: new Date(Date.now() - 1000),
    });

    await expect(verifySecondFactor(user.id, codeFor(secret), ENABLED, ok)).resolves.toBe("listo");

    const row = await readUser(user.id);
    expect(row.twoFactorFailedAttempts).toBe(0);
    expect(row.twoFactorLockedUntil).toBeNull();
  });

  test("un éxito reinicia el contador: cuatro fallos más no bloquean", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id);
    const wrong = wrongCodeFor(secret);

    for (let i = 0; i < 4; i++) {
      await expectAppError(verifySecondFactor(user.id, wrong, ENABLED, ok), 400, "INVALID_TWO_FACTOR_CODE");
    }
    await verifySecondFactor(user.id, codeFor(secret), ENABLED, ok);
    expect((await readUser(user.id)).twoFactorFailedAttempts).toBe(0);

    for (let i = 0; i < 4; i++) {
      await expectAppError(verifySecondFactor(user.id, wrong, ENABLED, ok), 400, "INVALID_TWO_FACTOR_CODE");
    }
    expect((await readUser(user.id)).twoFactorLockedUntil).toBeNull();
  });

  test("el contador se comparte entre usos: 3 fallos con recuperación y 2 sin ella bloquean al 5to", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id);
    const wrong = wrongCodeFor(secret);

    for (let i = 0; i < 3; i++) {
      await expectAppError(verifySecondFactor(user.id, wrong, ENABLED, ok), 400, "INVALID_TWO_FACTOR_CODE");
    }
    await expectAppError(verifySecondFactor(user.id, wrong, TOTP_ONLY, ok), 400, "INVALID_TWO_FACTOR_CODE");
    await expectAppError(verifySecondFactor(user.id, wrong, TOTP_ONLY, ok), 429, "TWO_FACTOR_LOCKED");
    await expectAppError(verifySecondFactor(user.id, codeFor(secret), ENABLED, ok), 429, "TWO_FACTOR_LOCKED");
  });

  test("10 intentos erróneos en paralelo evalúan el código 5 veces como máximo", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id);
    const wrong = wrongCodeFor(secret);
    const evaluations = jest.spyOn(totp, "matchTotpStep");

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => verifySecondFactor(user.id, wrong, ENABLED, ok))
    );

    const statuses = results.map((result) => {
      expect(result.status).toBe("rejected");
      return ((result as PromiseRejectedResult).reason as AppError).statusCode;
    });
    expect(evaluations.mock.calls.length).toBeLessThanOrEqual(5);
    expect(statuses.filter((status) => status === 400).length).toBeLessThanOrEqual(4);
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThanOrEqual(6);
    const row = await readUser(user.id);
    expect(row.twoFactorFailedAttempts).toBeLessThanOrEqual(5);
    expect(row.twoFactorLockedUntil).toBeInstanceOf(Date);
  });
});

describe("verifySecondFactor() — countFailures: false (enable)", () => {
  test("los fallos no tocan el contador ni el bloqueo, y no hay límite de intentos", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id, { enabled: false });
    const wrong = wrongCodeFor(secret);

    for (let i = 0; i < 6; i++) {
      await expectAppError(verifySecondFactor(user.id, wrong, ENABLE_STEP, ok), 400, "INVALID_TWO_FACTOR_CODE");
    }

    const row = await readUser(user.id);
    expect(row.twoFactorFailedAttempts).toBe(0);
    expect(row.twoFactorLockedUntil).toBeNull();
  });

  test("ignora un bloqueo vigente y deja el contador y el bloqueo como estaban", async () => {
    const user = await newUser();
    const lockedUntil = new Date(Date.now() + 600_000);
    const { secret } = await seedTwoFactor(user.id, { enabled: false, failedAttempts: 3, lockedUntil });

    await expect(verifySecondFactor(user.id, codeFor(secret), ENABLE_STEP, ok)).resolves.toBe("listo");

    const row = await readUser(user.id);
    expect(row.twoFactorFailedAttempts).toBe(3);
    expect(row.twoFactorLockedUntil).toEqual(lockedUntil);
  });
});

describe("verifySecondFactor() — códigos de recuperación (A8)", () => {
  test("un código sirve una sola vez y queda marcado como usado", async () => {
    const user = await newUser();
    const { recoveryCodes } = await seedTwoFactor(user.id);
    const onSuccess = jest.fn(async () => "listo");

    await verifySecondFactor(user.id, recoveryCodes[0], ENABLED, onSuccess);

    expect(onSuccess).toHaveBeenCalledWith(expect.anything(), {
      method: "recovery",
      secretEnc: expect.any(String),
    });
    const used = await prisma.twoFactorRecoveryCode.findMany({ where: { userId: user.id, usedAt: { not: null } } });
    expect(used).toHaveLength(1);
    expect(used[0].codeHash).toBe(hashRecoveryCode(recoveryCodes[0]));
    await expectAppError(verifySecondFactor(user.id, recoveryCodes[0], ENABLED, ok), 400, "INVALID_TWO_FACTOR_CODE");
  });

  test("acepta el código sin guion, en minúsculas y con espacios", async () => {
    const user = await newUser();
    const { recoveryCodes } = await seedTwoFactor(user.id);
    const [first, second] = recoveryCodes;

    await expect(verifySecondFactor(user.id, first.replace("-", "").toLowerCase(), ENABLED, ok)).resolves.toBe("listo");
    await expect(verifySecondFactor(user.id, ` ${second.toLowerCase()} `, ENABLED, ok)).resolves.toBe("listo");
  });

  test("dos usos simultáneos del mismo código: exactamente uno entra", async () => {
    const user = await newUser();
    const { recoveryCodes } = await seedTwoFactor(user.id);

    const results = await Promise.allSettled([
      verifySecondFactor(user.id, recoveryCodes[0], ENABLED, ok),
      verifySecondFactor(user.id, recoveryCodes[0], ENABLED, ok),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect((rejected.reason as AppError).code).toBe("INVALID_TWO_FACTOR_CODE");
    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id, usedAt: { not: null } } })).toBe(1);
  });

  test("un código desconocido cuenta como fallo", async () => {
    const user = await newUser();
    await seedTwoFactor(user.id);

    await expectAppError(verifySecondFactor(user.id, "AAAAA-AAAAA", ENABLED, ok), 400, "INVALID_TWO_FACTOR_CODE");

    expect((await readUser(user.id)).twoFactorFailedAttempts).toBe(1);
  });

  test("con allowRecovery false un código de recuperación válido se rechaza y no se gasta", async () => {
    const user = await newUser();
    const { recoveryCodes } = await seedTwoFactor(user.id);

    await expectAppError(verifySecondFactor(user.id, recoveryCodes[0], TOTP_ONLY, ok), 400, "INVALID_TWO_FACTOR_CODE");

    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id, usedAt: { not: null } } })).toBe(0);
  });

  test("el código de otro usuario no sirve", async () => {
    const owner = await newUser();
    const other = await newUser();
    const { recoveryCodes } = await seedTwoFactor(owner.id);
    await seedTwoFactor(other.id);

    await expectAppError(verifySecondFactor(other.id, recoveryCodes[0], ENABLED, ok), 400, "INVALID_TWO_FACTOR_CODE");
    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: owner.id, usedAt: null } })).toBe(10);
  });

  test("si onSuccess falla el código de recuperación no queda gastado", async () => {
    const user = await newUser();
    const { recoveryCodes } = await seedTwoFactor(user.id);

    await expect(
      verifySecondFactor(user.id, recoveryCodes[0], ENABLED, async () => {
        throw new Error("falló el efecto");
      })
    ).rejects.toThrow("falló el efecto");

    await expect(verifySecondFactor(user.id, recoveryCodes[0], ENABLED, ok)).resolves.toBe("listo");
  });
});

describe("verifySecondFactor() — clave de cifrado (A13)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("sin clave en producción responde 503 y no toca el contador", async () => {
    const user = await newUser();
    const { secret } = await seedTwoFactor(user.id, { failedAttempts: 2 });
    process.env.NODE_ENV = "production";
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY;

    const error = await expectAppError(
      verifySecondFactor(user.id, wrongCodeFor(secret), ENABLED, ok),
      503,
      "TWO_FACTOR_NOT_CONFIGURED"
    );

    expect(error.message).toContain("TWO_FACTOR_ENCRYPTION_KEY");
    expect((await readUser(user.id)).twoFactorFailedAttempts).toBe(2);
  });

  test("un secreto que no se puede descifrar responde 503 y no toca el contador", async () => {
    const user = await newUser();
    await seedTwoFactor(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecretEnc: "v1.mal.cifrado.dato" } });
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expectAppError(verifySecondFactor(user.id, "123456", ENABLED, ok), 503, "TWO_FACTOR_NOT_CONFIGURED");

    expect((await readUser(user.id)).twoFactorFailedAttempts).toBe(0);
  });

  test("un secreto cifrado para otro usuario no se puede usar", async () => {
    const owner = await newUser();
    const thief = await newUser();
    await seedTwoFactor(owner.id);
    await seedTwoFactor(thief.id);
    const ownerRow = await readUser(owner.id);
    await prisma.user.update({ where: { id: thief.id }, data: { twoFactorSecretEnc: ownerRow.twoFactorSecretEnc } });
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expectAppError(verifySecondFactor(thief.id, "123456", ENABLED, ok), 503, "TWO_FACTOR_NOT_CONFIGURED");
  });
});
