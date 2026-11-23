import { HeadBucketCommand } from "@aws-sdk/client-s3";

const sendMock = jest.fn();
const verifyMock = jest.fn();
const createTransport = jest.fn((..._args: unknown[]) => ({ verify: verifyMock, sendMail: jest.fn() }));

jest.mock("@aws-sdk/client-s3", () => {
  const original = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...original,
    S3Client: jest.fn().mockImplementation(() => ({ send: (...args: unknown[]) => sendMock(...args) })),
  };
});

jest.mock("nodemailer", () => ({
  createTransport: (...args: unknown[]) => createTransport(...args),
}));

import {
  checkAiService,
  checkInternalKey,
  checkOsmTiles,
  checkR2,
  checkSmtp,
  formatPreflightReport,
  preflightExitCode,
  runPreflight,
} from "../../src/scripts/preflight-checks";

const R2_ENV = {
  R2_ENDPOINT: "https://test-account.r2.cloudflarestorage.com",
  R2_BUCKET_NAME: "test-bucket",
  R2_PUBLIC_URL: "https://pub-test.r2.dev",
  R2_ACCESS_KEY_ID: "test-access-key-id",
  R2_SECRET_ACCESS_KEY: "test-secret-access-key",
};

const AI_ENV = { AI_SERVICE_URL: "http://backend-ia:8000", INTERNAL_API_KEY: "clave-compartida" };

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock = jest.fn();
  global.fetch = fetchMock;
  sendMock.mockResolvedValue({});
});

describe("checkR2", () => {
  test.each(Object.keys(R2_ENV))("FAIL si falta %s, sin llamar a R2", async (name) => {
    const env = { ...R2_ENV, [name]: undefined };

    const result = await checkR2(env);

    expect(result.status).toBe("FAIL");
    expect(result.message).toContain(name);
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("FAIL si HeadBucket falla (credenciales o bucket incorrectos)", async () => {
    sendMock.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "Forbidden" }));

    const result = await checkR2(R2_ENV);

    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("test-bucket");
  });

  test("WARN si el bucket responde pero no hay PREFLIGHT_R2_OBJECT_KEY", async () => {
    const result = await checkR2(R2_ENV);

    expect(sendMock.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
    expect(sendMock.mock.calls[0][0].input).toEqual({ Bucket: "test-bucket" });
    expect(result.status).toBe("WARN");
    expect(result.message).toContain("PREFLIGHT_R2_OBJECT_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("OK si el bucket responde y el objeto conocido es público", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const result = await checkR2({ ...R2_ENV, PREFLIGHT_R2_OBJECT_KEY: "pets/demo.jpg" });

    expect(result.status).toBe("OK");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://pub-test.r2.dev/pets/demo.jpg");
    expect(options.method).toBe("HEAD");
  });

  test("FAIL si la URL pública del objeto conocido no responde 2xx", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    const result = await checkR2({ ...R2_ENV, PREFLIGHT_R2_OBJECT_KEY: "pets/demo.jpg" });

    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("404");
  });
});

describe("checkInternalKey", () => {
  test("FAIL sin AI_SERVICE_URL", async () => {
    const result = await checkInternalKey({ INTERNAL_API_KEY: "x" });

    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("AI_SERVICE_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("FAIL sin INTERNAL_API_KEY", async () => {
    const result = await checkInternalKey({ AI_SERVICE_URL: "http://backend-ia:8000" });

    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("INTERNAL_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("OK con 422: la clave pasó y el cuerpo vacío se rechazó", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422 });

    const result = await checkInternalKey(AI_ENV);

    expect(result.status).toBe("OK");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://backend-ia:8000/images/analyze");
    expect(options.method).toBe("POST");
    expect(options.headers["X-Internal-Key"]).toBe("clave-compartida");
  });

  test("FAIL con 401: las claves no coinciden", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    const result = await checkInternalKey(AI_ENV);

    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("no coinciden");
  });

  test("WARN ante una respuesta inesperada", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const result = await checkInternalKey(AI_ENV);

    expect(result.status).toBe("WARN");
    expect(result.message).toContain("500");
  });

  test("FAIL si el Backend IA no responde", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const result = await checkInternalKey(AI_ENV);

    expect(result.status).toBe("FAIL");
  });
});

describe("checkAiService", () => {
  test("OK si /health responde", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await expect(checkAiService(AI_ENV)).resolves.toMatchObject({ status: "OK" });
    expect(fetchMock.mock.calls[0][0]).toBe("http://backend-ia:8000/health");
  });

  test("FAIL si no responde", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(checkAiService(AI_ENV)).resolves.toMatchObject({ status: "FAIL" });
  });

  test("FAIL sin AI_SERVICE_URL", async () => {
    const result = await checkAiService({});

    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("AI_SERVICE_URL");
  });
});

describe("checkOsmTiles", () => {
  test("OK si el tile responde, con el User-Agent de Nominatim", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const result = await checkOsmTiles({ NOMINATIM_USER_AGENT: "Patitas-test/1.0" });

    expect(result.status).toBe("OK");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://tile.openstreetmap.org/0/0/0.png");
    expect(options.method).toBe("HEAD");
    expect(options.headers["User-Agent"]).toBe("Patitas-test/1.0");
  });

  test.each([
    ["responde con error", () => fetchMock.mockResolvedValue({ ok: false, status: 403 })],
    ["no hay red", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))],
  ])("FAIL si %s: el mapa se verá gris", async (_label, arrange) => {
    arrange();

    const result = await checkOsmTiles({});

    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("gris");
  });
});

describe("checkSmtp", () => {
  test("WARN sin SMTP_HOST: modo consola", async () => {
    const result = await checkSmtp({});

    expect(result.status).toBe("WARN");
    expect(result.message).toContain("consola");
    expect(createTransport).not.toHaveBeenCalled();
  });

  test("FAIL sin SMTP_HOST en producción", async () => {
    const result = await checkSmtp({ NODE_ENV: "production" });

    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("SMTP_HOST");
  });

  test("OK si el servidor SMTP acepta la conexión", async () => {
    verifyMock.mockResolvedValue(true);

    const result = await checkSmtp({ SMTP_HOST: "smtp.test", SMTP_PORT: "2525" });

    expect(result.status).toBe("OK");
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp.test", port: 2525 }));
    expect(verifyMock).toHaveBeenCalled();
  });

  test("FAIL si verify falla", async () => {
    verifyMock.mockRejectedValue(new Error("Invalid login"));

    const result = await checkSmtp({ SMTP_HOST: "smtp.test" });

    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("Invalid login");
  });
});

describe("runPreflight", () => {
  test("corre los chequeos y conserva el orden", async () => {
    const results = await runPreflight([
      { name: "A", run: async () => ({ status: "OK", message: "bien" }) },
      { name: "B", run: async () => ({ status: "WARN", message: "ojo" }) },
    ]);

    expect(results).toEqual([
      { name: "A", status: "OK", message: "bien" },
      { name: "B", status: "WARN", message: "ojo" },
    ]);
  });

  test("un chequeo que tarda más que su timeout queda en FAIL", async () => {
    const results = await runPreflight(
      [{ name: "lento", run: () => new Promise(() => {}) }],
      { checkTimeoutMs: 10, globalTimeoutMs: 1000 }
    );

    expect(results[0].status).toBe("FAIL");
    expect(results[0].message).toContain("sin respuesta");
  });

  test("el tope global corta los chequeos pendientes", async () => {
    const results = await runPreflight(
      [
        { name: "rápido", run: async () => ({ status: "OK", message: "bien" }) },
        { name: "colgado", run: () => new Promise(() => {}) },
      ],
      { checkTimeoutMs: 1000, globalTimeoutMs: 10 }
    );

    expect(results[0]).toEqual({ name: "rápido", status: "OK", message: "bien" });
    expect(results[1].status).toBe("FAIL");
  });

  test("un chequeo que lanza queda en FAIL con el mensaje del error", async () => {
    const results = await runPreflight([
      {
        name: "roto",
        run: async () => {
          throw new Error("boom");
        },
      },
    ]);

    expect(results[0]).toMatchObject({ status: "FAIL", message: expect.stringContaining("boom") });
  });
});

describe("preflightExitCode", () => {
  test("1 si algún chequeo es FAIL", () => {
    expect(
      preflightExitCode([
        { name: "A", status: "OK", message: "" },
        { name: "B", status: "FAIL", message: "" },
      ])
    ).toBe(1);
  });

  test("0 si solo hay OK y WARN", () => {
    expect(
      preflightExitCode([
        { name: "A", status: "OK", message: "" },
        { name: "B", status: "WARN", message: "" },
      ])
    ).toBe(0);
  });
});

describe("formatPreflightReport", () => {
  test("una línea por chequeo con estado, nombre y mensaje", () => {
    const report = formatPreflightReport([
      { name: "R2", status: "OK", message: "bucket accesible" },
      { name: "SMTP", status: "WARN", message: "modo consola" },
    ]);

    const lines = report.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/OK.*R2.*bucket accesible/);
    expect(lines[1]).toMatch(/WARN.*SMTP.*modo consola/);
  });
});
