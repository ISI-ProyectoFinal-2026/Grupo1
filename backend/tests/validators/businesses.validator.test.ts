import { createBusinessSchema, updateBusinessSchema } from "../../src/validators/businesses.validator";

const baseBusiness = {
  name: "Veterinaria San Roque",
  cuit: "20-12345678-9",
  address: "Av. San Martín 123",
  phone: "2604112233",
  category: "VETERINARIA",
  location: { lat: -34.6251, lng: -68.3221 },
};

describe("createBusinessSchema: location", () => {
  test("acepta coordenadas dentro de rango", () => {
    expect(createBusinessSchema.safeParse(baseBusiness).success).toBe(true);
  });

  test("exige la ubicación al registrar el comercio", () => {
    const { location: _omitted, ...withoutLocation } = baseBusiness;
    expect(createBusinessSchema.safeParse(withoutLocation).success).toBe(false);
  });

  test.each([
    ["lat > 90", { lat: 91, lng: -68.32 }],
    ["lat < -90", { lat: -91, lng: -68.32 }],
    ["lng > 180", { lat: -34.62, lng: 181 }],
    ["lng < -180", { lat: -34.62, lng: -181 }],
    ["lat no numérica", { lat: "-34.62", lng: -68.32 }],
  ])("rechaza %s", (_case, location) => {
    expect(createBusinessSchema.safeParse({ ...baseBusiness, location }).success).toBe(false);
  });
});

describe("updateBusinessSchema: location", () => {
  test("la ubicación es opcional al editar", () => {
    expect(updateBusinessSchema.safeParse({ phone: "2604998877" }).success).toBe(true);
  });

  test("rechaza coordenadas fuera de rango al editar", () => {
    expect(updateBusinessSchema.safeParse({ location: { lat: -34.62, lng: 200 } }).success).toBe(false);
  });
});
