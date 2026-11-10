import { prisma } from "../../src/db/client";
import * as petsService from "../../src/services/pets.service";
import * as matchingService from "../../src/services/matching.service";

// #254: las fotos de mascotas pasan por el mismo screening que las de reportes.
// Prisma se stubbea: el foco es la decisión tomada con el veredicto de analyzeImage.
describe("pets.service image screening", () => {
  const NO_ANIMAL_MESSAGE =
    "Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM";

  const fotoA = "https://pub-test.r2.dev/pets/a.jpg";
  const fotoB = "https://pub-test.r2.dev/pets/b.jpg";

  const petData = {
    userId: 7,
    name: "Firulais",
    breed: "Labrador",
    age: 3,
    color: "Marrón",
    description: "Collar rojo",
    photoUrls: [fotoA, fotoB],
  };

  let petCreate: jest.SpyInstance;
  let petUpdate: jest.SpyInstance;
  let analyzeSpy: jest.SpyInstance;

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    petCreate = jest.spyOn(prisma.pet, "create").mockResolvedValue({ id: 5 } as never);
    petUpdate = jest.spyOn(prisma.pet, "update").mockResolvedValue({ id: 5 } as never);
    jest.spyOn(prisma.pet, "findUnique").mockResolvedValue({ id: 5, userId: 7, photoUrls: [fotoA] } as never);
    analyzeSpy = jest.spyOn(matchingService, "analyzeImage");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  describe("create()", () => {
    test("rechaza con 422 y el mensaje de SPAM si una foto no tiene animal, sin crear nada", async () => {
      analyzeSpy.mockImplementation(async (url: string) => (url === fotoB ? "no_animal" : "animal"));

      const promise = petsService.create(petData);

      await expect(promise).rejects.toMatchObject({ statusCode: 422, message: NO_ANIMAL_MESSAGE });
      expect(analyzeSpy).toHaveBeenCalledWith(fotoA);
      expect(analyzeSpy).toHaveBeenCalledWith(fotoB);
      expect(petCreate).not.toHaveBeenCalled();
    });

    test.each(["animal", "animal_low_quality", "unavailable"] as const)(
      "crea la mascota cuando el veredicto es %s",
      async (verdict) => {
        analyzeSpy.mockResolvedValue(verdict);

        await petsService.create(petData);

        expect(analyzeSpy).toHaveBeenCalledTimes(2);
        expect(petCreate).toHaveBeenCalled();
      }
    );

    test("analiza cada una de las 4 fotos (máximo permitido)", async () => {
      analyzeSpy.mockResolvedValue("animal");
      const cuatroFotos = ["a", "b", "c", "d"].map((n) => `https://pub-test.r2.dev/pets/${n}.jpg`);

      await petsService.create({ ...petData, photoUrls: cuatroFotos });

      expect(analyzeSpy).toHaveBeenCalledTimes(4);
      cuatroFotos.forEach((url) => expect(analyzeSpy).toHaveBeenCalledWith(url));
      expect(petCreate).toHaveBeenCalled();
    });

    // mismo criterio que reportes: fuera del bucket R2 no hay veredicto síncrono (SSRF)
    test("no analiza fotos fuera del bucket R2", async () => {
      await petsService.create({ ...petData, photoUrls: ["https://cdn.example.com/foto.jpg"] });

      expect(analyzeSpy).not.toHaveBeenCalled();
      expect(petCreate).toHaveBeenCalled();
    });
  });

  describe("update()", () => {
    test("rechaza con 422 una foto nueva sin animal, sin modificar nada", async () => {
      analyzeSpy.mockResolvedValue("no_animal");

      const promise = petsService.update(5, 7, { photoUrls: [fotoA, fotoB] });

      await expect(promise).rejects.toMatchObject({ statusCode: 422, message: NO_ANIMAL_MESSAGE });
      expect(petUpdate).not.toHaveBeenCalled();
    });

    test("solo analiza las fotos que no estaban guardadas", async () => {
      analyzeSpy.mockResolvedValue("animal");

      await petsService.update(5, 7, { photoUrls: [fotoA, fotoB] });

      expect(analyzeSpy).toHaveBeenCalledTimes(1);
      expect(analyzeSpy).toHaveBeenCalledWith(fotoB);
      expect(petUpdate).toHaveBeenCalled();
    });

    test("con 4 fotos solo analiza las 3 nuevas", async () => {
      analyzeSpy.mockResolvedValue("animal");
      const nuevas = ["b", "c", "d"].map((n) => `https://pub-test.r2.dev/pets/${n}.jpg`);

      await petsService.update(5, 7, { photoUrls: [fotoA, ...nuevas] });

      expect(analyzeSpy).toHaveBeenCalledTimes(3);
      expect(analyzeSpy).not.toHaveBeenCalledWith(fotoA);
      expect(petUpdate).toHaveBeenCalled();
    });

    test("deja guardar cuando el análisis no está disponible", async () => {
      analyzeSpy.mockResolvedValue("unavailable");

      await petsService.update(5, 7, { photoUrls: [fotoB] });

      expect(petUpdate).toHaveBeenCalled();
    });

    test.each([
      ["no se mandan fotos", { name: "Otro nombre" }],
      ["las fotos no cambian", { photoUrls: [fotoA] }],
    ])("no analiza nada cuando %s", async (_case, changes) => {
      await petsService.update(5, 7, changes);

      expect(analyzeSpy).not.toHaveBeenCalled();
      expect(petUpdate).toHaveBeenCalled();
    });

    test("no analiza fotos de una mascota ajena: responde 403 antes", async () => {
      await expect(petsService.update(5, 8, { photoUrls: [fotoB] })).rejects.toMatchObject({ statusCode: 403 });
      expect(analyzeSpy).not.toHaveBeenCalled();
    });
  });
});
