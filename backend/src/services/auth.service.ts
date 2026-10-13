import { Prisma, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { signAccessToken } from "../utils/jwt";
import { toPublicUser } from "../utils/public-user";
import { LoginInput, RegisterInput, ResetPasswordInput } from "../validators/auth.validator";
import { consumeAuthToken, issueAuthToken, latestAuthTokenCreatedAt } from "./auth-tokens.service";
import { assertMailConfigured } from "./mail";
import * as mailService from "./mail.service";

const SALT_ROUNDS = 12;

// Mínimo entre dos mails de verificación del mismo usuario. Se mide contra la
// base (no con un limiter en memoria) para que valga en todas las instancias y
// también en los tests.
const RESEND_COOLDOWN_MS = 60_000;

// Precomputed at module load so login always pays the same bcrypt.compare cost,
// whether or not the email exists — otherwise the missing-user fast path leaks
// account existence via response timing.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", SALT_ROUNDS);

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/** Link a una pantalla del frontend que recibe el token por query string. */
function frontendLink(path: string, token: string): string {
  const base = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${base}${path}?token=${token}`;
}

async function sendVerificationEmail(user: Pick<User, "id" | "email">): Promise<void> {
  const token = await issueAuthToken(user.id, "email_verification");
  await mailService.sendEmailVerification(user.email, frontendLink("/verify-email", token));
}

export async function register(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  let user: User;
  try {
    user = await prisma.user.create({
      data: { email: input.email, passwordHash },
    });
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      throw new AppError(409, "El email ya está registrado");
    }
    throw error;
  }

  // La cuenta ya existe: si el mail no sale, el usuario puede pedir el reenvío
  // desde la app. Fallar acá dejaría una cuenta creada con un 500 de respuesta.
  try {
    await sendVerificationEmail(user);
  } catch (error) {
    console.error(`[auth] no se pudo enviar el mail de verificación al usuario ${user.id}:`, error);
  }

  return toPublicUser(user);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Always compare against a real hash (dummy when no user) and use the same
  // generic message for both cases, so neither timing nor the response body
  // reveals whether the email exists.
  const isValidPassword = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !isValidPassword) {
    throw new AppError(401, "Credenciales inválidas");
  }

  return { token: signAccessToken(user), user: toPublicUser(user) };
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, "Usuario no encontrado");
  }
  return toPublicUser(user);
}

export async function verifyEmail(token: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const userId = await consumeAuthToken(tx, token, "email_verification");
    // Idempotente: si ya estaba verificado se conserva la fecha original.
    await tx.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  });
}

export async function resendEmailVerification(userId: number): Promise<void> {
  // Primero: sin correo configurado no se emite ningún token ni se gasta el cooldown.
  assertMailConfigured();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, "Usuario no encontrado");
  }
  if (user.emailVerifiedAt) {
    throw new AppError(409, "Tu email ya está verificado");
  }

  const lastIssuedAt = await latestAuthTokenCreatedAt(userId, "email_verification");
  if (lastIssuedAt) {
    const elapsedMs = Date.now() - lastIssuedAt.getTime();
    if (elapsedMs < RESEND_COOLDOWN_MS) {
      throw new AppError(
        429,
        "Esperá un minuto antes de pedir otro email",
        { retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000) },
        "RESEND_COOLDOWN"
      );
    }
  }

  // Acá sí se propaga un error de envío: el usuario lo pidió explícitamente y
  // tiene que saber que no le llegó.
  await sendVerificationEmail(user);
}

/**
 * Emite el token de reset y manda el mail, solo si el email existe. No revela
 * nada por sí misma: el controller la dispara en segundo plano y responde
 * siempre lo mismo, sin esperar, para que ni el cuerpo ni la latencia de la
 * respuesta delaten si la cuenta existe.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) {
    return;
  }

  const token = await issueAuthToken(user.id, "password_reset");
  await mailService.sendPasswordReset(user.email, frontendLink("/reset-password", token));
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  // bcrypt fuera de la transacción: son ~250ms que no tienen por qué tener la
  // conexión tomada.
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    const userId = await consumeAuthToken(tx, input.token, "password_reset");
    const now = new Date();

    // Subir tokenVersion invalida todos los JWT emitidos hasta ahora: si la
    // contraseña se reseteó por un robo de cuenta, las sesiones abiertas mueren.
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    await tx.authToken.updateMany({
      where: { userId, type: "password_reset", usedAt: null },
      data: { usedAt: now },
    });
  });
}
