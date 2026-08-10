import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as petsService from "../../src/services/pets.service";

describe("pets.service", () => {
  let userId: number;
  const createdPetIds: number[] = [];

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `pets-service-test-${Date.now()}@example.com`,
        passwordHash: "test-hash",
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    while (createdPetIds.length > 0) {
      const id = createdPetIds.pop()!;
      await prisma.pet.deleteMany({ where: { id } });
    }
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test("create() crea una mascota asociada al usuario", async () => {
    const pet = await petsService.create({ userId, name: "Firulais", species: "dog" });
    createdPetIds.push(pet.id);

    expect(pet.id).toBeDefined();
    expect(pet.userId).toBe(userId);
    expect(pet.name).toBe("Firulais");
  });

  test("create() lanza AppError 400 si el userId no existe", async () => {
    await expect(petsService.create({ userId: 999999999, name: "Sin dueño" })).rejects.toMatchObject(
      { statusCode: 400 }
    );
  });

  test("list() incluye las mascotas creadas", async () => {
    const pet = await petsService.create({ userId, name: "Lista" });
    createdPetIds.push(pet.id);

    const pets = await petsService.list();
    expect(pets.some((p) => p.id === pet.id)).toBe(true);
  });

  test("getById() devuelve la mascota correcta", async () => {
    const pet = await petsService.create({ userId, name: "Buscada" });
    createdPetIds.push(pet.id);

    const found = await petsService.getById(pet.id);
    expect(found.id).toBe(pet.id);
    expect(found.name).toBe("Buscada");
  });

  test("getById() lanza AppError 404 si no existe", async () => {
    await expect(petsService.getById(-1)).rejects.toMatchObject(
      new AppError(404, "Mascota no encontrada")
    );
  });

  test("update() modifica los campos indicados", async () => {
    const pet = await petsService.create({ userId, name: "Original" });
    createdPetIds.push(pet.id);

    const updated = await petsService.update(pet.id, { name: "Actualizada" });
    expect(updated.name).toBe("Actualizada");
  });

  test("update() lanza AppError 404 si no existe", async () => {
    await expect(petsService.update(-1, { name: "x" })).rejects.toMatchObject({ statusCode: 404 });
  });

  test("remove() elimina la mascota", async () => {
    const pet = await petsService.create({ userId, name: "A borrar" });

    await petsService.remove(pet.id);

    await expect(petsService.getById(pet.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  test("remove() lanza AppError 404 si no existe", async () => {
    await expect(petsService.remove(-1)).rejects.toMatchObject({ statusCode: 404 });
  });
});
