import { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { CreatePetInput, UpdatePetInput } from "../validators/pets.validator";

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export function list() {
  return prisma.pet.findMany();
}

export async function create(data: CreatePetInput) {
  try {
    return await prisma.pet.create({ data });
  } catch (error) {
    if (isPrismaKnownError(error, "P2003")) {
      throw new AppError(400, "userId no corresponde a un usuario existente");
    }
    throw error;
  }
}

export async function getById(id: number) {
  const pet = await prisma.pet.findUnique({ where: { id } });
  if (!pet) {
    throw new AppError(404, "Mascota no encontrada");
  }
  return pet;
}

export async function update(id: number, data: UpdatePetInput) {
  try {
    return await prisma.pet.update({ where: { id }, data });
  } catch (error) {
    if (isPrismaKnownError(error, "P2025")) {
      throw new AppError(404, "Mascota no encontrada");
    }
    throw error;
  }
}

export async function remove(id: number) {
  try {
    await prisma.pet.delete({ where: { id } });
  } catch (error) {
    if (isPrismaKnownError(error, "P2025")) {
      throw new AppError(404, "Mascota no encontrada");
    }
    throw error;
  }
}
