import { z } from "zod";
import { MAX_PET_PHOTOS, createPetSchema, updatePetSchema } from "../../src/validators/pets.validator";

const MAX_MESSAGE = "Podés subir hasta 4 fotos";
const basePet = { name: "Rocky", breed: "Labrador", age: 3, color: "Marrón", description: "Mascota" };
const photos = (count: number) => Array.from({ length: count }, (_, i) => `https://pub-test.r2.dev/pets/${i}.jpg`);

function photoMessages(result: { success: boolean; error?: z.ZodError }): string[] {
  return result.error?.issues.filter((issue) => issue.path[0] === "photoUrls").map((issue) => issue.message) ?? [];
}

describe("pets validator: cantidad de fotos", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("el máximo es 4", () => {
    expect(MAX_PET_PHOTOS).toBe(4);
  });

  describe.each([
    ["createPetSchema", createPetSchema],
    ["updatePetSchema", updatePetSchema],
  ] as const)("%s", (_name, schema) => {
    test.each([1, 4])("acepta %i fotos", (count) => {
      expect(schema.safeParse({ ...basePet, photoUrls: photos(count) }).success).toBe(true);
    });

    test("rechaza 5 fotos con un mensaje claro", () => {
      const result = schema.safeParse({ ...basePet, photoUrls: photos(5) });

      expect(result.success).toBe(false);
      expect(photoMessages(result)).toEqual([MAX_MESSAGE]);
    });

    test("rechaza la lista vacía", () => {
      const result = schema.safeParse({ ...basePet, photoUrls: [] });

      expect(photoMessages(result)).toEqual(["Se requiere al menos una foto"]);
    });
  });

  test("updatePetSchema permite omitir las fotos", () => {
    expect(updatePetSchema.safeParse({ name: "Rocky" }).success).toBe(true);
  });
});
