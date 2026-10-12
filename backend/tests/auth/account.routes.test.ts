import { createHash } from "crypto";
import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as mailService from "../../src/services/mail.service";

const INVALID_LINK = "El enlace es inválido o expiró";
const FORGOT_PASSWORD_MESSAGE = "Si el email está registrado, te enviamos un enlace para restablecer tu contraseña";

function tokenFromLink(link: string): string {
  const token = new URL(link).searchParams.get("token");
  if (!token) {
    throw new Error(`el link no trae token: ${link}`);
  }
  return token;
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("waitFor: se agotó el tiempo de espera");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("verificación de email y recuperación de contraseña (/api/auth)", () => {
  const createdEmails: string[] = [];
  let verificationSpy: jest.SpyInstance;
  let resetSpy: jest.SpyInstance;

  beforeEach(() => {
    verificationSpy = jest.spyOn(mailService, "sendEmailVerification").mockResolvedValue();
    resetSpy = jest.spyOn(mailService, "sendPasswordReset").mockResolvedValue();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    // Los auth_tokens se borran en cascada con el usuario.
    await prisma.user.deleteMany({ where: { email: { in: createdEmails.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function uniqueEmail(prefix: string): string {
    const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdEmails.push(email);
    return email;
  }

  /** Registra por la API y devuelve el token de verificación que salió por mail. */
  async function registerUser(prefix: string, password = "Password123") {
    const email = uniqueEmail(prefix);
    const res = await request(app).post("/api/auth/register").send({ email, password });
    expect(res.status).toBe(201);
    const link = verificationSpy.mock.calls.at(-1)![1] as string;
    return { email, password, userId: res.body.id as number, verificationToken: tokenFromLink(link) };
  }

  /** Envejece los tokens de verificación del usuario: simula que pasó ese tiempo desde que se pidió el último. */
  async function ageVerificationTokens(userId: number, seconds: number): Promise<void> {
    await prisma.authToken.updateMany({
      where: { userId, type: "email_verification" },
      data: { createdAt: new Date(Date.now() - seconds * 1000) },
    });
  }

  /** Corre `fn` como si el backend estuviera en producción sin SMTP_HOST (y restaura el entorno). */
  async function withProductionWithoutSmtp(fn: () => Promise<void>): Promise<void> {
    const original = { NODE_ENV: process.env.NODE_ENV, SMTP_HOST: process.env.SMTP_HOST };
    process.env.NODE_ENV = "production";
    delete process.env.SMTP_HOST;
    try {
      await fn();
    } finally {
      process.env.NODE_ENV = original.NODE_ENV;
      if (original.SMTP_HOST === undefined) {
        delete process.env.SMTP_HOST;
      } else {
        process.env.SMTP_HOST = original.SMTP_HOST;
      }
    }
  }

  async function loginToken(email: string, password: string): Promise<string> {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    return res.body.token;
  }

  /** Pide el reset por la API y espera a que el mail (que sale en segundo plano) se "envíe". */
  async function requestResetToken(email: string): Promise<string> {
    const callsBefore = resetSpy.mock.calls.length;
    const res = await request(app).post("/api/auth/forgot-password").send({ email });
    expect(res.status).toBe(200);
    await waitFor(() => resetSpy.mock.calls.length > callsBefore);
    return tokenFromLink(resetSpy.mock.calls.at(-1)![1] as string);
  }

  describe("POST /api/auth/verify-email", () => {
    test("con el token del mail verifica el email", async () => {
      const { email, password, verificationToken } = await registerUser("verify-ok");

      const res = await request(app).post("/api/auth/verify-email").send({ token: verificationToken });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: "Tu email quedó verificado" });

      const token = await loginToken(email, password);
      const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
      expect(me.body.emailVerifiedAt).toEqual(expect.any(String));
      expect(Number.isNaN(Date.parse(me.body.emailVerifiedAt))).toBe(false);
    });

    test("no guarda el token en claro, solo su hash", async () => {
      const { userId, verificationToken } = await registerUser("verify-hash");

      const stored = await prisma.authToken.findMany({ where: { userId } });

      expect(stored).toHaveLength(1);
      expect(stored[0].type).toBe("email_verification");
      expect(stored[0].tokenHash).toBe(createHash("sha256").update(verificationToken).digest("hex"));
      expect(stored[0].tokenHash).not.toBe(verificationToken);
    });

    test("el token es de un solo uso: reusarlo responde 400", async () => {
      const { verificationToken } = await registerUser("verify-reuse");
      await request(app).post("/api/auth/verify-email").send({ token: verificationToken });

      const res = await request(app).post("/api/auth/verify-email").send({ token: verificationToken });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe(INVALID_LINK);
    });

    test("un token vencido responde 400 y no verifica", async () => {
      const { userId, verificationToken } = await registerUser("verify-expired");
      await prisma.authToken.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1000) } });

      const res = await request(app).post("/api/auth/verify-email").send({ token: verificationToken });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe(INVALID_LINK);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.emailVerifiedAt).toBeNull();
    });

    test("un token que no existe responde 400", async () => {
      const res = await request(app).post("/api/auth/verify-email").send({ token: "token-que-no-existe" });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe(INVALID_LINK);
    });

    test("sin token responde 400 de validación", async () => {
      const res = await request(app).post("/api/auth/verify-email").send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Datos inválidos");
    });

    test("un token de reset de contraseña no sirve para verificar el email", async () => {
      const { email } = await registerUser("verify-wrong-type");
      const resetToken = await requestResetToken(email);

      const res = await request(app).post("/api/auth/verify-email").send({ token: resetToken });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe(INVALID_LINK);
    });
  });

  describe("POST /api/auth/verify-email/resend", () => {
    test("con email sin verificar manda un mail nuevo e invalida el link anterior", async () => {
      const { email, password, userId, verificationToken: oldToken } = await registerUser("resend-ok");
      const token = await loginToken(email, password);
      await ageVerificationTokens(userId, 61);

      const res = await request(app).post("/api/auth/verify-email/resend").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: "Te mandamos un nuevo email de verificación" });
      expect(verificationSpy).toHaveBeenCalledTimes(2);
      expect(verificationSpy.mock.calls[1][0]).toBe(email);
      const newToken = tokenFromLink(verificationSpy.mock.calls[1][1] as string);
      expect(newToken).not.toBe(oldToken);

      const withOld = await request(app).post("/api/auth/verify-email").send({ token: oldToken });
      expect(withOld.status).toBe(400);
      const withNew = await request(app).post("/api/auth/verify-email").send({ token: newToken });
      expect(withNew.status).toBe(200);
    });

    test("con el email ya verificado responde 409 y no manda nada", async () => {
      const { email, password, verificationToken } = await registerUser("resend-verified");
      await request(app).post("/api/auth/verify-email").send({ token: verificationToken });
      const token = await loginToken(email, password);
      verificationSpy.mockClear();

      const res = await request(app).post("/api/auth/verify-email/resend").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("Tu email ya está verificado");
      expect(verificationSpy).not.toHaveBeenCalled();
    });

    test("sin token responde 401", async () => {
      const res = await request(app).post("/api/auth/verify-email/resend");

      expect(res.status).toBe(401);
    });

    test("dentro de los 60 s del último token responde 429 RESEND_COOLDOWN, sin token nuevo ni mail", async () => {
      const { email, password, userId } = await registerUser("resend-cooldown");
      const token = await loginToken(email, password);
      await ageVerificationTokens(userId, 30);
      const tokensBefore = await prisma.authToken.count({ where: { userId } });
      verificationSpy.mockClear();

      const res = await request(app).post("/api/auth/verify-email/resend").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("RESEND_COOLDOWN");
      expect(res.body.error.message).toBe("Esperá un minuto antes de pedir otro email");
      expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
      expect(res.body.error.details.retryAfterSeconds).toBeLessThanOrEqual(30);
      expect(await prisma.authToken.count({ where: { userId } })).toBe(tokensBefore);
      expect(verificationSpy).not.toHaveBeenCalled();
    });

    test("el token del registro cuenta para el cooldown: pedir el reenvío al toque da 429", async () => {
      const { email, password } = await registerUser("resend-after-register");
      const token = await loginToken(email, password);

      const res = await request(app).post("/api/auth/verify-email/resend").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("RESEND_COOLDOWN");
    });

    test("el segundo pedido seguido también da 429 y pasados 61 s vuelve a dar 200", async () => {
      const { email, password, userId } = await registerUser("resend-twice");
      const token = await loginToken(email, password);
      await ageVerificationTokens(userId, 61);

      const first = await request(app).post("/api/auth/verify-email/resend").set("Authorization", `Bearer ${token}`);
      const second = await request(app).post("/api/auth/verify-email/resend").set("Authorization", `Bearer ${token}`);
      await ageVerificationTokens(userId, 61);
      const third = await request(app).post("/api/auth/verify-email/resend").set("Authorization", `Bearer ${token}`);

      expect([first.status, second.status, third.status]).toEqual([200, 429, 200]);
    });

    test("con el email ya verificado responde 409 aunque el último token sea reciente", async () => {
      const { email, password, userId } = await registerUser("resend-verified-recent");
      await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
      const token = await loginToken(email, password);

      const res = await request(app).post("/api/auth/verify-email/resend").set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(409);
    });

    test("en producción sin SMTP_HOST responde 503 nombrando la variable, sin gastar token ni cooldown", async () => {
      const { email, password, userId } = await registerUser("resend-no-smtp");
      const token = await loginToken(email, password);
      await ageVerificationTokens(userId, 61);
      const tokensBefore = await prisma.authToken.count({ where: { userId } });

      await withProductionWithoutSmtp(async () => {
        const res = await request(app).post("/api/auth/verify-email/resend").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe("MAIL_NOT_CONFIGURED");
        expect(res.body.error.message).toContain("SMTP_HOST");
        expect(res.body.error.details).toEqual({ missingEnvVars: ["SMTP_HOST"] });
      });

      expect(await prisma.authToken.count({ where: { userId } })).toBe(tokensBefore);
    });
  });

  describe("register con el correo sin configurar en producción", () => {
    test("igual responde 201 y deja el error logueado (la cuenta ya existe)", async () => {
      verificationSpy.mockRestore();
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const email = uniqueEmail("register-no-smtp");

      await withProductionWithoutSmtp(async () => {
        const res = await request(app).post("/api/auth/register").send({ email, password: "Password123" });

        expect(res.status).toBe(201);
      });

      expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("no se pudo enviar el mail de verificación"), expect.anything());
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    test("con un email registrado responde 200 genérico y manda el link de reset", async () => {
      const { email } = await registerUser("forgot-existing");

      const res = await request(app).post("/api/auth/forgot-password").send({ email });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: FORGOT_PASSWORD_MESSAGE });
      await waitFor(() => resetSpy.mock.calls.length === 1);
      expect(resetSpy.mock.calls[0][0]).toBe(email);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      expect(resetSpy.mock.calls[0][1]).toMatch(new RegExp(`^${frontendUrl}/reset-password\\?token=`));
    });

    test("con un email no registrado responde exactamente lo mismo y no manda nada", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: `nadie-${Date.now()}@example.com` });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: FORGOT_PASSWORD_MESSAGE });
      // El envío corre en segundo plano: se le da margen antes de afirmar que no pasó.
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(resetSpy).not.toHaveBeenCalled();
    });

    test("si falla el envío del mail igual responde 200 (y el error queda logueado)", async () => {
      const { email } = await registerUser("forgot-mail-fails");
      resetSpy.mockRejectedValue(new Error("smtp caído"));
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app).post("/api/auth/forgot-password").send({ email });

      expect(res.status).toBe(200);
      await waitFor(() => errorSpy.mock.calls.length > 0);
    });

    test("con un email mal formado responde 400 de validación", async () => {
      const res = await request(app).post("/api/auth/forgot-password").send({ email: "no-es-un-email" });

      expect(res.status).toBe(400);
    });

    test("en producción sin SMTP_HOST responde 503 igual para cualquier email (no revela si existe)", async () => {
      const { email, userId } = await registerUser("forgot-no-smtp");

      await withProductionWithoutSmtp(async () => {
        const existing = await request(app).post("/api/auth/forgot-password").send({ email });
        const unknown = await request(app)
          .post("/api/auth/forgot-password")
          .send({ email: `nadie-${Date.now()}@example.com` });

        for (const res of [existing, unknown]) {
          expect(res.status).toBe(503);
          expect(res.body.error.code).toBe("MAIL_NOT_CONFIGURED");
          expect(res.body.error.message).toContain("SMTP_HOST");
        }
        expect(unknown.body).toEqual(existing.body);
      });

      // Falló antes de buscar al usuario: no se emitió ningún token de reset.
      expect(await prisma.authToken.count({ where: { userId, type: "password_reset" } })).toBe(0);
      expect(resetSpy).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/reset-password", () => {
    test("cambia la contraseña y cierra todas las sesiones abiertas", async () => {
      const { email, password } = await registerUser("reset-ok");
      const oldJwt = await loginToken(email, password);
      const resetToken = await requestResetToken(email);

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: resetToken, password: "NuevaClave456" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: "Tu contraseña se actualizó, iniciá sesión con la nueva" });

      const withOldPassword = await request(app).post("/api/auth/login").send({ email, password });
      expect(withOldPassword.status).toBe(401);

      const newJwt = await loginToken(email, "NuevaClave456");

      const withOldJwt = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldJwt}`);
      expect(withOldJwt.status).toBe(401);
      expect(withOldJwt.body.error.message).toBe("Tu sesión expiró, iniciá sesión de nuevo");

      const withNewJwt = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${newJwt}`);
      expect(withNewJwt.status).toBe(200);
    });

    test("el token es de un solo uso", async () => {
      const { email } = await registerUser("reset-reuse");
      const resetToken = await requestResetToken(email);
      await request(app).post("/api/auth/reset-password").send({ token: resetToken, password: "NuevaClave456" });

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: resetToken, password: "OtraClave789" });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe(INVALID_LINK);
      await loginToken(email, "NuevaClave456");
    });

    test("un token vencido responde 400 y no cambia la contraseña", async () => {
      const { email, password, userId } = await registerUser("reset-expired");
      const resetToken = await requestResetToken(email);
      await prisma.authToken.updateMany({
        where: { userId, type: "password_reset" },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: resetToken, password: "NuevaClave456" });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe(INVALID_LINK);
      await loginToken(email, password);
    });

    test("pedir un reset nuevo invalida el link anterior", async () => {
      const { email } = await registerUser("reset-superseded");
      const firstToken = await requestResetToken(email);
      await requestResetToken(email);

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: firstToken, password: "NuevaClave456" });

      expect(res.status).toBe(400);
    });

    test("usar un reset invalida cualquier otro link de reset pendiente del usuario", async () => {
      const { email, userId } = await registerUser("reset-invalidates-others");
      const resetToken = await requestResetToken(email);
      // Un segundo token vigente, como el que dejaría una carrera entre dos pedidos.
      await prisma.authToken.create({
        data: {
          userId,
          type: "password_reset",
          tokenHash: createHash("sha256").update(`otro-token-${userId}`).digest("hex"),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await request(app).post("/api/auth/reset-password").send({ token: resetToken, password: "NuevaClave456" });
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: `otro-token-${userId}`, password: "OtraClave789" });

      expect(res.status).toBe(400);
    });

    test("una contraseña débil responde 400 y no consume el token", async () => {
      const { email } = await registerUser("reset-weak");
      const resetToken = await requestResetToken(email);

      const weak = await request(app).post("/api/auth/reset-password").send({ token: resetToken, password: "debil" });

      expect(weak.status).toBe(400);
      expect(weak.body.error.message).toBe("Datos inválidos");

      const strong = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: resetToken, password: "NuevaClave456" });
      expect(strong.status).toBe(200);
    });

    test("un token de verificación de email no sirve para resetear la contraseña", async () => {
      const { verificationToken } = await registerUser("reset-wrong-type");

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: verificationToken, password: "NuevaClave456" });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe(INVALID_LINK);
    });
  });
});
