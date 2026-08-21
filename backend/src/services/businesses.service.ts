import { Business, Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { CreateBusinessInput, UpdateBusinessInput } from "../validators/businesses.validator";

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function isUniqueConflictOn(error: Prisma.PrismaClientKnownRequestError, column: string): boolean {
  const target = error.meta?.target;
  return Array.isArray(target) && target.includes(column);
}

export interface BusinessStats {
  views: number;
  contacts: number;
}

export async function create(data: CreateBusinessInput & { userId: number }): Promise<Business> {
  try {
    return await prisma.business.create({ data });
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      const prismaError = error as Prisma.PrismaClientKnownRequestError;
      if (isUniqueConflictOn(prismaError, "cuit")) {
        throw new AppError(409, "El CUIT ya está registrado");
      }
      throw new AppError(409, "El usuario ya tiene un comercio registrado");
    }
    if (isPrismaKnownError(error, "P2003")) {
      throw new AppError(400, "userId no corresponde a un usuario existente");
    }
    throw error;
  }
}

export async function getByUserId(userId: number): Promise<Business> {
  const business = await prisma.business.findUnique({ where: { userId } });
  if (!business) {
    throw new AppError(404, "Comercio no encontrado");
  }
  return business;
}

export async function updateByUserId(userId: number, data: UpdateBusinessInput): Promise<Business> {
  await getByUserId(userId);

  try {
    return await prisma.business.update({ where: { userId }, data });
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      throw new AppError(409, "El CUIT ya está registrado");
    }
    throw error;
  }
}

export async function getStats(userId: number): Promise<BusinessStats> {
  await getByUserId(userId);
  // No existe infraestructura de analytics (vistas/contactos) en el proyecto
  // todavía: se devuelve un stub en cero hasta que se implemente el tracking.
  return { views: 0, contacts: 0 };
}
