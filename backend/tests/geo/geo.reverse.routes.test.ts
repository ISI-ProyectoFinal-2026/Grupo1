import request from "supertest";
import { AppError } from "../../src/errors/app-error";

const reverseMock = jest.fn();
jest.mock("../../src/services/reverse-geocode.service", () => ({
  reverseGeocoder: { reverse: (...args: unknown[]) => reverseMock(...args) },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");

describe("GET /api/geo/reverse", () => {
  beforeEach(() => reverseMock.mockReset());

  test("responde 200 con la direccion", async () => {
    reverseMock.mockResolvedValue("San Rafael");

    const res = await request(app).get("/api/geo/reverse?lat=-34.6177&lng=-68.3301");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ address: "San Rafael" });
    expect(reverseMock).toHaveBeenCalledWith(-34.6177, -68.3301);
  });

  test("responde address null si no hay ciudad ni localidad", async () => {
    reverseMock.mockResolvedValue(null);

    const res = await request(app).get("/api/geo/reverse?lat=-34.6&lng=-68.3");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ address: null });
  });

  test("responde 400 con coordenadas invalidas o faltantes", async () => {
    expect((await request(app).get("/api/geo/reverse?lat=200&lng=-68.3")).status).toBe(400);
    expect((await request(app).get("/api/geo/reverse?lat=-34.6")).status).toBe(400);
    expect(reverseMock).not.toHaveBeenCalled();
  });

  test("propaga el error del servicio (503 cola llena)", async () => {
    reverseMock.mockRejectedValue(new AppError(503, "ocupado"));

    const res = await request(app).get("/api/geo/reverse?lat=-34.6&lng=-68.3");

    expect(res.status).toBe(503);
  });
});
