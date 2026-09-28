import { ReportDTO } from "../../src/services/reports.service";

const getObjectMetadataMock = jest.fn();
const uploadBufferMock = jest.fn();
const loadImageMock = jest.fn();

jest.mock("../../src/services/storage.service", () => ({
  getObjectMetadata: (...args: unknown[]) => getObjectMetadataMock(...args),
  uploadBuffer: (...args: unknown[]) => uploadBufferMock(...args),
  publicObjectUrl: (key: string) => `https://pub-test.r2.dev/${key}`,
}));

jest.mock("@napi-rs/canvas", () => {
  const actual = jest.requireActual("@napi-rs/canvas");
  return { ...actual, loadImage: (...args: unknown[]) => loadImageMock(...args) };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getOrCreateFlyerUrl } = require("../../src/services/flyer.service");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const canvas = jest.requireActual("@napi-rs/canvas");

const FLYER_KEY = "flyers/report-1.png";
const FLYER_URL = `https://pub-test.r2.dev/${FLYER_KEY}`;
const DEGRADED_RETRY_MS = 10 * 60 * 1000;

// URL versionada: la key en R2 es fija, así que el `?v=` es lo que evita que
// el navegador/CDN siga mostrando un flyer viejo después de regenerarlo.
function versionedUrl(version: string): string {
  return `${FLYER_URL}?v=${version.slice(0, 12)}`;
}

function lastUploadedMetadata(): Record<string, string> {
  const calls = uploadBufferMock.mock.calls;
  return calls[calls.length - 1][3];
}

function buildReport(overrides: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: 1,
    userId: 1,
    petId: null,
    reportType: "lost",
    status: "published",
    title: "Gato gris perdido en San Telmo",
    description: "Collar rojo, muy asustadizo",
    imageUrl: null,
    customFlyerUrl: null,
    locationAddress: "San Telmo, CABA",
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-01T10:00:00Z"),
    publishedAt: new Date("2026-09-01T10:00:00Z"),
    location: { lat: -34.6, lng: -58.37 },
    tag: { label: "PERDIDO", color: "#EF4444" },
    ...overrides,
  };
}

// Simula R2: guarda la metadata de lo último que se subió a cada key.
let bucket: Map<string, Record<string, string>>;

beforeEach(() => {
  bucket = new Map();
  getObjectMetadataMock.mockReset();
  uploadBufferMock.mockReset();
  loadImageMock.mockReset();

  getObjectMetadataMock.mockImplementation(async (key: string) => bucket.get(key) ?? null);
  uploadBufferMock.mockImplementation(
    async (key: string, _body: Buffer, _contentType: string, metadata: Record<string, string> = {}) => {
      bucket.set(key, metadata);
      return `https://pub-test.r2.dev/${key}`;
    }
  );
  const tinyPng: Buffer = canvas.createCanvas(4, 4).toBuffer("image/png");
  loadImageMock.mockImplementation(() => canvas.loadImage(tinyPng));
});

describe("getOrCreateFlyerUrl (cache del PNG en R2)", () => {
  test("cache miss: si el PNG no existe, lo compone y lo sube con su versión en metadata", async () => {
    const url = await getOrCreateFlyerUrl(buildReport());

    expect(uploadBufferMock).toHaveBeenCalledTimes(1);
    const [key, body, contentType, metadata] = uploadBufferMock.mock.calls[0];
    expect(key).toBe(FLYER_KEY);
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(contentType).toBe("image/png");
    expect(metadata["flyer-version"]).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata["flyer-degraded-at"]).toBeUndefined();
    expect(url).toBe(versionedUrl(metadata["flyer-version"]));
  });

  test("cache hit: si el PNG existe y el reporte no cambió, devuelve la misma URL sin recomponer ni subir", async () => {
    const report = buildReport({ imageUrl: "https://pub-test.r2.dev/pets/gato.jpg" });
    const firstUrl = await getOrCreateFlyerUrl(report);
    const version = lastUploadedMetadata()["flyer-version"];
    uploadBufferMock.mockClear();
    loadImageMock.mockClear();

    const url = await getOrCreateFlyerUrl(report);

    expect(url).toBe(versionedUrl(version));
    expect(url).toBe(firstUrl);
    expect(uploadBufferMock).not.toHaveBeenCalled();
    expect(loadImageMock).not.toHaveBeenCalled();
  });

  test.each<[string, Partial<ReportDTO>]>([
    ["title", { title: "Gato gris ENCONTRADO en San Telmo" }],
    ["description", { description: "Collar azul" }],
    ["locationAddress", { locationAddress: "Palermo, CABA" }],
    ["imageUrl", { imageUrl: "https://pub-test.r2.dev/pets/otra-foto.jpg" }],
    ["tag (reporte resuelto)", { status: "resolved", tag: { label: "RESUELTO", color: "#22C55E" } }],
  ])("cache miss tras cambiar %s: regenera el PNG y devuelve otra URL", async (_field, change) => {
    const original = buildReport();
    const firstUrl = await getOrCreateFlyerUrl(original);
    const firstVersion = uploadBufferMock.mock.calls[0][3]["flyer-version"];
    uploadBufferMock.mockClear();

    const url = await getOrCreateFlyerUrl({ ...original, ...change, updatedAt: new Date("2026-09-02T10:00:00Z") });

    expect(uploadBufferMock).toHaveBeenCalledTimes(1);
    expect(uploadBufferMock.mock.calls[0][0]).toBe(FLYER_KEY);
    const newVersion = uploadBufferMock.mock.calls[0][3]["flyer-version"];
    expect(newVersion).not.toBe(firstVersion);
    // misma key en R2 pero otra URL: el navegador no reusa el PNG viejo
    expect(url).toBe(versionedUrl(newVersion));
    expect(url).not.toBe(firstUrl);
  });

  test("no regenera por cambios que el flyer no muestra (updatedAt, ubicación, customFlyerUrl)", async () => {
    const original = buildReport();
    await getOrCreateFlyerUrl(original);
    uploadBufferMock.mockClear();

    await getOrCreateFlyerUrl({
      ...original,
      updatedAt: new Date("2026-09-02T10:00:00Z"),
      location: { lat: -34.7, lng: -58.4 },
      customFlyerUrl: "https://cdn.example.com/otro.png",
    });

    expect(uploadBufferMock).not.toHaveBeenCalled();
  });

  test("un reporte sin foto (imageUrl null) sí se cachea y no queda marcado como degradado", async () => {
    const report = buildReport({ imageUrl: null });
    await getOrCreateFlyerUrl(report);
    expect(lastUploadedMetadata()["flyer-degraded-at"]).toBeUndefined();
    uploadBufferMock.mockClear();

    await getOrCreateFlyerUrl(report);

    expect(uploadBufferMock).not.toHaveBeenCalled();
  });
});

// Si la foto del reporte no se pudo bajar, el flyer sale con el placeholder.
// Se cachea igual (si no, CADA request recompone y sube a R2), pero marcado
// como degradado para reintentar la foto cuando vence la ventana.
describe("getOrCreateFlyerUrl (flyer degradado por falla al bajar la foto)", () => {
  const T0 = new Date("2026-09-28T12:00:00.000Z");
  const report = buildReport({ imageUrl: "https://pub-test.r2.dev/pets/gato.jpg" });

  beforeEach(() => {
    jest.useFakeTimers({ now: T0 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("sube el placeholder con versión y marca de degradado, con una URL distinta a la del flyer bueno", async () => {
    loadImageMock.mockRejectedValueOnce(new Error("timeout"));

    const url = await getOrCreateFlyerUrl(report);

    expect(uploadBufferMock).toHaveBeenCalledTimes(1);
    const metadata = lastUploadedMetadata();
    expect(metadata["flyer-version"]).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata["flyer-degraded-at"]).toBe(T0.toISOString());
    expect(url.startsWith(`${FLYER_URL}?v=`)).toBe(true);
    expect(url).not.toBe(versionedUrl(metadata["flyer-version"]));
  });

  test("dentro de la ventana de reintento es cache hit: no baja la foto ni sube nada", async () => {
    loadImageMock.mockRejectedValueOnce(new Error("timeout"));
    const degradedUrl = await getOrCreateFlyerUrl(report);
    uploadBufferMock.mockClear();
    loadImageMock.mockClear();

    jest.setSystemTime(T0.getTime() + DEGRADED_RETRY_MS - 1);
    const url = await getOrCreateFlyerUrl(report);

    expect(url).toBe(degradedUrl);
    expect(loadImageMock).not.toHaveBeenCalled();
    expect(uploadBufferMock).not.toHaveBeenCalled();
  });

  test("vencida la ventana reintenta la foto; si sale bien, queda cacheado sin marca y con otra URL", async () => {
    loadImageMock.mockRejectedValueOnce(new Error("timeout"));
    const degradedUrl = await getOrCreateFlyerUrl(report);
    uploadBufferMock.mockClear();
    loadImageMock.mockClear();

    jest.setSystemTime(T0.getTime() + DEGRADED_RETRY_MS);
    const url = await getOrCreateFlyerUrl(report);

    expect(loadImageMock).toHaveBeenCalledTimes(1);
    expect(uploadBufferMock).toHaveBeenCalledTimes(1);
    const metadata = lastUploadedMetadata();
    expect(metadata["flyer-degraded-at"]).toBeUndefined();
    expect(url).toBe(versionedUrl(metadata["flyer-version"]));
    expect(url).not.toBe(degradedUrl);

    // a partir de acá es un cache hit normal, sin importar el tiempo
    uploadBufferMock.mockClear();
    jest.setSystemTime(T0.getTime() + 10 * DEGRADED_RETRY_MS);
    await expect(getOrCreateFlyerUrl(report)).resolves.toBe(url);
    expect(uploadBufferMock).not.toHaveBeenCalled();
  });

  test("vencida la ventana, si la foto sigue fallando, renueva la marca y cambia la URL", async () => {
    loadImageMock.mockRejectedValueOnce(new Error("timeout"));
    const firstDegradedUrl = await getOrCreateFlyerUrl(report);
    uploadBufferMock.mockClear();

    const retryAt = new Date(T0.getTime() + DEGRADED_RETRY_MS);
    jest.setSystemTime(retryAt);
    loadImageMock.mockRejectedValueOnce(new Error("timeout"));
    const url = await getOrCreateFlyerUrl(report);

    expect(uploadBufferMock).toHaveBeenCalledTimes(1);
    expect(lastUploadedMetadata()["flyer-degraded-at"]).toBe(retryAt.toISOString());
    expect(url).not.toBe(firstDegradedUrl);
  });

  test("una marca de degradado ilegible se trata como vencida y reintenta la foto", async () => {
    loadImageMock.mockRejectedValueOnce(new Error("timeout"));
    await getOrCreateFlyerUrl(report);
    bucket.set(FLYER_KEY, { ...lastUploadedMetadata(), "flyer-degraded-at": "no-es-una-fecha" });
    uploadBufferMock.mockClear();
    loadImageMock.mockClear();

    await getOrCreateFlyerUrl(report);

    expect(loadImageMock).toHaveBeenCalledTimes(1);
    expect(uploadBufferMock).toHaveBeenCalledTimes(1);
  });
});
