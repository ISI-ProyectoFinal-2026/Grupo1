import { Prisma, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { LoginInput, RegisterInput } from "../validators/auth.validator";

const SALT_ROUNDS = 12;

// Precomputed at module load so login always pays the same bcrypt.compare cost,
// whether or not the email exists — otherwise the missing-user fast path leaks
// account existence via response timing.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", SALT_ROUNDS);

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function withoutPasswordHash(user: User): Omit<User, "passwordHash"> {
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function register(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: { email: input.email, passwordHash },
    });
    return withoutPasswordHash(user);
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      throw new AppError(409, "El email ya está registrado");
    }
    throw error;
  }
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

  const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRY || "24h",
  } as jwt.SignOptions);

  return { token, user: withoutPasswordHash(user) };
}
