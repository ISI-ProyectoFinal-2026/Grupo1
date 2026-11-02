import { AppError } from "../../src/errors/app-error";
import {
  REVERSE_GEOCODE_MIN_INTERVAL_MS,
  REVERSE_GEOCODE_MAX_QUEUE,
  createReverseGeocoder,
} from "../../src/services/reverse-geocode.service";

function nominatimResponse(address: Record<string, string>): Response {
  return { ok: true, status: 200, json: async () => ({ address }) } as Response;
}

// reloj falso: sleep avanza el tiempo, asi el throttle se prueba sin esperar
function setup(fetchFn: jest.Mock) {
  let clock = 1_000_000;
  const sleep = jest.fn(async (ms: number) => {
    clock += ms;
  });
  const geocoder = createReverseGeocoder({
    fetchFn: fetchFn as unknown as typeof fetch,
    now: () => clock,
    sleep,
    userAgent: "Patitas-test/1.0",
  });
  return { geocoder, sleep, getClock: () => clock };
}

describe("reverse-geocode.service", () => {
  test("devuelve la ciudad y consulta Nominatim con User-Agent", async () => {
    const fetchFn = jest.fn().mockResolvedValue(nominatimResponse({ city: "San Rafael" }));
    const { geocoder } = setup(fetchFn);

    await expect(geocoder.reverse(-34.6177, -68.3301)).resolves.toBe("San Rafael");

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain("https://nominatim.openstreetmap.org/reverse");
    expect(url).toContain("format=json");
    expect(init.headers["User-Agent"]).toBe("Patitas-test/1.0");
  });

  test("usa town si no hay city y null si no hay ninguno", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(nominatimResponse({ town: "Cuadro Nacional" }))
      .mockResolvedValueOnce(nominatimResponse({ state: "Mendoza" }));
    const { geocoder } = setup(fetchFn);

    await expect(geocoder.reverse(-34.5, -68.1)).resolves.toBe("Cuadro Nacional");
    await expect(geocoder.reverse(-35.5, -69.1)).resolves.toBeNull();
  });

  test("coordenadas cercanas comparten la misma entrada de cache", async () => {
    const fetchFn = jest.fn().mockResolvedValue(nominatimResponse({ city: "San Rafael" }));
    const { geocoder } = setup(fetchFn);

    await geocoder.reverse(-34.61771, -68.33011);
    await geocoder.reverse(-34.61774, -68.33009);

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("consultas simultaneas a la misma zona hacen una sola llamada", async () => {
    const fetchFn = jest.fn().mockResolvedValue(nominatimResponse({ city: "San Rafael" }));
    const { geocoder } = setup(fetchFn);

    const results = await Promise.all([
      geocoder.reverse(-34.6177, -68.3301),
      geocoder.reverse(-34.6177, -68.3301),
    ]);

    expect(results).toEqual(["San Rafael", "San Rafael"]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("separa las llamadas a Nominatim al menos el intervalo minimo", async () => {
    const callTimes: number[] = [];
    let getClock = () => 0;
    const fetchFn = jest.fn().mockImplementation(async () => {
      callTimes.push(getClock());
      return nominatimResponse({ city: "X" });
    });
    const ctx = setup(fetchFn);
    getClock = ctx.getClock;

    await Promise.all([
      ctx.geocoder.reverse(-34.1, -68.1),
      ctx.geocoder.reverse(-34.2, -68.2),
      ctx.geocoder.reverse(-34.3, -68.3),
    ]);

    expect(callTimes).toHaveLength(3);
    expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(REVERSE_GEOCODE_MIN_INTERVAL_MS);
    expect(callTimes[2] - callTimes[1]).toBeGreaterThanOrEqual(REVERSE_GEOCODE_MIN_INTERVAL_MS);
  });

  test("rechaza con 503 si la cola de espera esta llena", async () => {
    const fetchFn = jest.fn().mockResolvedValue(nominatimResponse({ city: "X" }));
    const { geocoder } = setup(fetchFn);

    const calls = Array.from({ length: REVERSE_GEOCODE_MAX_QUEUE + 1 }, (_, i) =>
      geocoder.reverse(-30 - i, -60 - i).then(
        () => "ok",
        (error: AppError) => error.statusCode
      )
    );
    const results = await Promise.all(calls);

    expect(results.filter((r) => r === 503)).toHaveLength(1);
  });

  test("si Nominatim responde error lanza 502 y no cachea el fallo", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
      .mockResolvedValueOnce(nominatimResponse({ city: "San Rafael" }));
    const { geocoder } = setup(fetchFn);

    await expect(geocoder.reverse(-34.6, -68.3)).rejects.toMatchObject({ statusCode: 502 });
    await expect(geocoder.reverse(-34.6, -68.3)).resolves.toBe("San Rafael");
  });
});
