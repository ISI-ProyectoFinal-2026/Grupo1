import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as mailModule from "../../src/services/mail";
import * as mailService from "../../src/services/mail.service";
import { twoFactorClock } from "../../src/services/two-factor/clock";
import { codeFor } from "../helpers/two-factor";
import { createTestUser } from "../helpers/users";

const PASSWORD = "Password123";
const FRONTEND_URL = "https://patitas.test";
const HOUR_MS = 60 * 60 * 1000;

const SUBJECTS = {
  enabled: "Verificación en dos pasos activada en PATITAS",
  disabled: "Verificación en dos pasos desactivada en PATITAS",
  recoveryUsed: "Se usó un código de recuperación en tu cuenta de PATITAS",
  resetLink: "Confirmá el reinicio del segundo factor en PATITAS",
  resetPending: "Reinicio del segundo factor en curso en PATITAS",
  resetCancelled: "Se canceló el reinicio del segundo factor en PATITAS",
  resetCompleted: "Se desactivó el segundo factor de tu cuenta de PATITAS",
} as const;

describe("plantillas de mail del reinicio de 2FA", () => {
  const send = jest.fn();

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue(undefined);
    jest.spyOn(mailModule, "getMailSender").mockReturnValue({ send });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("sendTwoFactorResetLink manda el link de confirmación y explica la espera de 72 horas", async () => {
    const link = "https://front.test/two-factor/reset/confirm?token=abc";

    await mailService.sendTwoFactorResetLink("ana@example.com", link);

    expect(send).toHaveBeenCalledTimes(1);
    const message = send.mock.calls[0][0];
    expect(message.to).toBe("ana@example.com");
    expect(message.subject).toBe(SUBJECTS.resetLink);
    expect(message.text).toContain(link);
    expect(message.html).toContain(link);
    expect(message.text).toContain("72 horas");
  });

  test("sendTwoFactorResetPending trae el link de cancelación y la fecha en hora argentina", async () => {
    const link = "https://front.test/two-factor/reset/cancel?token=xyz";

    await mailService.sendTwoFactorResetPending("ana@example.com", link, new Date("2026-10-20T15:30:00.000Z"));

    const message = send.mock.calls[0][0];
    expect(message.to).toBe("ana@example.com");
    expect(message.subject).toBe(SUBJECTS.resetPending);
    expect(message.text).toContain(link);
    expect(message.html).toContain(link);
    expect(message.text).toContain("20 de octubre de 2026 a las 12:30");
    expect(message.html).toContain("20 de octubre de 2026 a las 12:30");
    expect(message.text).toContain("hora de Argentina");
  });

  test("sendTwoFactorResetPending usa la fecha que recibe y no una fija", async () => {
    await mailService.sendTwoFactorResetPending("ana@example.com", "https://f.test/c?token=1", new Date("2027-01-02T03:00:00.000Z"));

    expect(send.mock.calls[0][0].text).toContain("2 de enero de 2027 a las 00:00");
  });

  test("sendTwoFactorResetCancelled avisa que el 2FA sigue activo, sin links", async () => {
    await mailService.sendTwoFactorResetCancelled("ana@example.com");

    const message = send.mock.calls[0][0];
    expect(message.to).toBe("ana@example.com");
    expect(message.subject).toBe(SUBJECTS.resetCancelled);
    expect(message.text).toContain("sigue activ");
    expect(message.text).not.toMatch(/https?:\/\//);
    expect(message.html).not.toMatch(/https?:\/\//);
  });

  test("sendTwoFactorResetCompleted avisa que el 2FA quedó desactivado, sin links", async () => {
    await mailService.sendTwoFactorResetCompleted("ana@example.com");

    const message = send.mock.calls[0][0];
    expect(message.to).toBe("ana@example.com");
    expect(message.subject).toBe(SUBJECTS.resetCompleted);
    expect(message.text).toContain("quedó desactivada");
    expect(message.text).not.toMatch(/https?:\/\//);
  });

  test("los asuntos de las siete plantillas son distintos entre sí", () => {
    const subjects = Object.values(SUBJECTS);

    expect(new Set(subjects).size).toBe(7);
  });
});

describe("mails de un ciclo de vida completo de 2FA", () => {
  const sent: Array<{ to: string; subject: string; text: string; html: string }> = [];
  const secrets: string[] = [];
  const recoveryCodes: string[] = [];
  const totpCodes: string[] = [];
  const confirmTokens: string[] = [];
  const cancelTokens: string[] = [];
  const otherTokens: string[] = [];
  const originalFrontendUrl = process.env.FRONTEND_URL;
  let email = "";
  let userId = 0;
  let clockMs = Date.now();

  const tokenFromLink = (link: string) => new URL(link).searchParams.get("token") as string;
  const body = (message: { text: string; html: string }) => `${message.text}\n${message.html}`;

  /** Cada código TOTP se usa en un paso distinto del reloj: el anti-replay rechaza repetir uno. */
  function nextTotp(secret: string): string {
    clockMs += 61_000;
    const code = codeFor(secret, 0, clockMs);
    totpCodes.push(code);
    return code;
  }

  async function passwordLogin() {
    return request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  }

  async function enableTwoFactor(sessionToken: string) {
    const auth = { Authorization: `Bearer ${sessionToken}` };
    const setup = await request(app).post("/api/auth/2fa/setup").set(auth).send({});
    const secret = setup.body.secret as string;
    secrets.push(secret);
    const enabled = await request(app).post("/api/auth/2fa/enable").set(auth).send({ code: nextTotp(secret) });
    expect(enabled.status).toBe(200);
    recoveryCodes.push(...(enabled.body.recoveryCodes as string[]));
    return { secret, token: enabled.body.token as string, codes: enabled.body.recoveryCodes as string[] };
  }

  async function resetViaMail(challenge: string): Promise<{ confirmToken: string; cancelToken: string }> {
    const requested = await request(app).post("/api/auth/2fa/reset/request").send({ twoFactorToken: challenge, password: PASSWORD });
    expect(requested.status).toBe(200);
    const confirmToken = tokenFromLink(sent.filter((m) => m.subject === SUBJECTS.resetLink).at(-1)!.text.match(/https?:\/\/\S+/)![0]);
    confirmTokens.push(confirmToken);
    const confirmed = await request(app).post("/api/auth/2fa/reset/confirm").send({ token: confirmToken });
    expect(confirmed.status).toBe(200);
    const cancelToken = tokenFromLink(sent.filter((m) => m.subject === SUBJECTS.resetPending).at(-1)!.text.match(/https?:\/\/\S+\?token=\S+/)![0]);
    cancelTokens.push(cancelToken);
    return { confirmToken, cancelToken };
  }

  beforeAll(async () => {
    process.env.FRONTEND_URL = `${FRONTEND_URL}/`;
    jest.spyOn(twoFactorClock, "now").mockImplementation(() => clockMs);
    jest.spyOn(mailModule, "getMailSender").mockReturnValue({
      send: async (message) => {
        sent.push({ to: message.to, subject: message.subject, text: message.text, html: message.html ?? "" });
      },
    });

    const { user } = await createTestUser({ prefix: "tf-mail-lifecycle", password: PASSWORD });
    email = user.email;
    userId = user.id;

    // 1. activar (aviso de activación)
    const session = await passwordLogin();
    const first = await enableTwoFactor(session.body.token);

    // 2. login con código de recuperación (aviso de código usado)
    const recoveryChallenge = (await passwordLogin()).body.twoFactorToken as string;
    otherTokens.push(recoveryChallenge);
    expect((await request(app).post("/api/auth/2fa/login").send({ twoFactorToken: recoveryChallenge, code: first.codes[0] })).status).toBe(200);

    // 3. pedir, confirmar y cancelar por link (link, pendiente, cancelado)
    const cancelChallenge = (await passwordLogin()).body.twoFactorToken as string;
    otherTokens.push(cancelChallenge);
    const cancelled = await resetViaMail(cancelChallenge);
    expect((await request(app).post("/api/auth/2fa/reset/cancel").send({ token: cancelled.cancelToken })).status).toBe(200);

    // 4. pedir y confirmar de nuevo, dejar pasar las 72 h y completar con el login (completado)
    await prisma.authToken.updateMany({ where: { userId, type: "two_factor_reset" }, data: { createdAt: new Date(Date.now() - 120_000) } });
    const completeChallenge = (await passwordLogin()).body.twoFactorToken as string;
    otherTokens.push(completeChallenge);
    await resetViaMail(completeChallenge);
    await prisma.user.update({ where: { id: userId }, data: { twoFactorResetRequestedAt: new Date(Date.now() - 80 * HOUR_MS) } });
    const completed = await passwordLogin();
    expect(completed.body.token).toEqual(expect.any(String));

    // 5. volver a activar y desactivar (aviso de desactivación)
    const second = await enableTwoFactor(completed.body.token);
    const disabled = await request(app)
      .post("/api/auth/2fa/disable")
      .set({ Authorization: `Bearer ${second.token}` })
      .send({ password: PASSWORD, code: nextTotp(second.secret) });
    expect(disabled.status).toBe(200);
  }, 60_000);

  afterAll(async () => {
    process.env.FRONTEND_URL = originalFrontendUrl;
    jest.restoreAllMocks();
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test("cada plantilla se mandó al email de la cuenta", () => {
    for (const subject of Object.values(SUBJECTS)) {
      const matching = sent.filter((message) => message.subject === subject);
      expect(matching.length).toBeGreaterThanOrEqual(1);
      expect(matching.every((message) => message.to === email)).toBe(true);
    }
    expect(sent.every((message) => message.to === email)).toBe(true);
  });

  test("los links salen de FRONTEND_URL (sin barra doble) con las rutas /two-factor/reset/*", () => {
    const link = sent.find((m) => m.subject === SUBJECTS.resetLink)!;
    const pending = sent.find((m) => m.subject === SUBJECTS.resetPending)!;

    expect(link.text).toContain(`${FRONTEND_URL}/two-factor/reset/confirm?token=`);
    expect(link.html).toContain(`${FRONTEND_URL}/two-factor/reset/confirm?token=`);
    expect(pending.text).toContain(`${FRONTEND_URL}/two-factor/reset/cancel?token=`);
    expect(pending.html).toContain(`${FRONTEND_URL}/two-factor/reset/cancel?token=`);
  });

  test("ningún mail trae el secreto, un código de recuperación, un código TOTP ni la contraseña", () => {
    expect(secrets).toHaveLength(2);
    expect(recoveryCodes).toHaveLength(20);
    expect(totpCodes.length).toBeGreaterThanOrEqual(3);
    const forbidden = [...secrets, ...recoveryCodes, ...recoveryCodes.map((c) => c.replace("-", "")), ...totpCodes, PASSWORD];

    for (const message of sent) {
      const text = body(message);
      for (const value of forbidden) {
        expect(text).not.toContain(value);
      }
    }
  });

  test("cada mail trae a lo sumo el token del link para el que existe y ningún otro", () => {
    const everyToken = [...confirmTokens, ...cancelTokens, ...otherTokens];
    expect(confirmTokens).toHaveLength(2);
    expect(cancelTokens).toHaveLength(2);

    for (const message of sent) {
      const present = everyToken.filter((token) => body(message).includes(token));
      if (message.subject === SUBJECTS.resetLink) {
        expect(present.length).toBe(1);
        expect(confirmTokens).toContain(present[0]);
      } else if (message.subject === SUBJECTS.resetPending) {
        expect(present.length).toBe(1);
        expect(cancelTokens).toContain(present[0]);
      } else {
        expect(present).toEqual([]);
      }
    }
  });
});
