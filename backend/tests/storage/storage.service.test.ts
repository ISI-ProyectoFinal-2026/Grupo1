import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { AppError } from "../../src/errors/app-error";
import {
  createPresignedUpload,
  getObjectMetadata,
  publicObjectUrl,
  uploadBuffer,
} from "../../src/services/storage.service";

const sendMock = jest.fn();
const getSignedUrlMock = jest.fn();

jest.mock("@aws-sdk/client-s3", () => {
  const original = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...original,
    // se conservan los Command reales para inspeccionar su input
    S3Client: jest.fn().mockImplementation(() => ({ send: (...args: unknown[]) => sendMock(...args) })),
  };
});

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

const R2_ENV = {
  R2_ENDPOINT: "https://test-account.r2.cloudflarestorage.com",
  R2_BUCKET_NAME: "test-bucket",
  R2_PUBLIC_URL: "https://pub-test.r2.dev",
  R2_ACCESS_KEY_ID: "test-access-key-id",
  R2_SECRET_ACCESS_KEY: "test-secret-access-key",
};

describe("storage.service", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, R2_ENV);
    getSignedUrlMock.mockResolvedValue("https://signed.example.com/upload?sig=abc");
    sendMock.mockResolvedValue({});
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("configuración de R2", () => {
    test.each(Object.keys(R2_ENV))("responde 503 indicando que falta %s", async (name) => {
      delete process.env[name];

      const error = await createPresignedUpload({ fileName: "foto.jpg", contentType: "image/jpeg" } as never).catch(
        (e) => e
      );

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(503);
      expect(error.details).toEqual({ missingEnvVars: [name] });
      expect(getSignedUrlMock).not.toHaveBeenCalled();
    });

    test("lista todas las variables faltantes juntas", () => {
      delete process.env.R2_BUCKET_NAME;
      delete process.env.R2_PUBLIC_URL;

      try {
        publicObjectUrl("pets/x.jpg");
        throw new Error("debía lanzar");
      } catch (error) {
        expect((error as AppError).details).toEqual({ missingEnvVars: ["R2_BUCKET_NAME", "R2_PUBLIC_URL"] });
      }
    });

    test.each([
      ["getObjectMetadata", () => getObjectMetadata("pets/x.jpg")],
      ["uploadBuffer", () => uploadBuffer("pets/x.png", Buffer.from("x"), "image/png")],
    ])("%s también exige R2 configurado antes de llamar al SDK", async (_nombre, llamar) => {
      delete process.env.R2_ENDPOINT;

      await expect(llamar()).rejects.toMatchObject({ statusCode: 503 });
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe("createPresignedUpload", () => {
    test("devuelve la URL firmada, la URL pública y la key", async () => {
      const result = await createPresignedUpload({ fileName: "foto.jpg", contentType: "image/jpeg" } as never);

      expect(result.uploadUrl).toBe("https://signed.example.com/upload?sig=abc");
      expect(result.key).toMatch(/^pets\/[0-9a-f-]{36}\.jpg$/);
      expect(result.publicUrl).toBe(`https://pub-test.r2.dev/${result.key}`);
    });

    test.each([
      ["image/jpeg", "jpg"],
      ["image/png", "png"],
      ["image/webp", "webp"],
      ["application/octet-stream", "bin"],
    ])("la extensión de %s es .%s", async (contentType, extension) => {
      const { key } = await createPresignedUpload({ fileName: "archivo", contentType } as never);

      expect(key.endsWith(`.${extension}`)).toBe(true);
    });

    test("firma un PutObject del bucket, la key y el content type con vencimiento de 5 minutos", async () => {
      const { key } = await createPresignedUpload({ fileName: "foto.png", contentType: "image/png" } as never);

      const [, command, options] = getSignedUrlMock.mock.calls[0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({ Bucket: "test-bucket", Key: key, ContentType: "image/png" });
      expect(options).toEqual({ expiresIn: 300 });
    });

    test("genera una key distinta en cada llamada", async () => {
      const input = { fileName: "foto.jpg", contentType: "image/jpeg" } as never;

      const a = await createPresignedUpload(input);
      const b = await createPresignedUpload(input);

      expect(a.key).not.toBe(b.key);
    });

    test("propaga el error del firmador", async () => {
      getSignedUrlMock.mockRejectedValue(new Error("fallo al firmar"));

      await expect(
        createPresignedUpload({ fileName: "foto.jpg", contentType: "image/jpeg" } as never)
      ).rejects.toThrow("fallo al firmar");
    });
  });

  describe("publicObjectUrl", () => {
    test("concatena la URL pública con la key", () => {
      expect(publicObjectUrl("flyers/5.png")).toBe("https://pub-test.r2.dev/flyers/5.png");
    });
  });

  describe("getObjectMetadata", () => {
    test("devuelve la metadata de usuario del objeto con un HEAD", async () => {
      sendMock.mockResolvedValue({ Metadata: { hash: "abc123" } });

      await expect(getObjectMetadata("flyers/5.png")).resolves.toEqual({ hash: "abc123" });

      const command = sendMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(HeadObjectCommand);
      expect(command.input).toEqual({ Bucket: "test-bucket", Key: "flyers/5.png" });
    });

    test("devuelve un objeto vacío si el objeto no tiene metadata", async () => {
      sendMock.mockResolvedValue({});

      await expect(getObjectMetadata("flyers/5.png")).resolves.toEqual({});
    });

    test.each([
      ["NotFound por nombre", { name: "NotFound" }],
      ["404 por status HTTP", { name: "Otro", $metadata: { httpStatusCode: 404 } }],
    ])("devuelve null si el objeto no existe (%s)", async (_caso, error) => {
      sendMock.mockRejectedValue(error);

      await expect(getObjectMetadata("flyers/5.png")).resolves.toBeNull();
    });

    test("propaga cualquier otro error de R2 en vez de tomarlo como inexistente", async () => {
      const error = Object.assign(new Error("degradado"), { $metadata: { httpStatusCode: 503 } });
      sendMock.mockRejectedValue(error);

      await expect(getObjectMetadata("flyers/5.png")).rejects.toBe(error);
    });
  });

  describe("uploadBuffer", () => {
    test("sube el buffer con su content type y metadata, y devuelve la URL pública", async () => {
      const body = Buffer.from("png-bytes");

      const url = await uploadBuffer("flyers/5.png", body, "image/png", { hash: "abc123" });

      expect(url).toBe("https://pub-test.r2.dev/flyers/5.png");
      const command = sendMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: "test-bucket",
        Key: "flyers/5.png",
        Body: body,
        ContentType: "image/png",
        Metadata: { hash: "abc123" },
      });
    });

    test("usa metadata vacía por defecto", async () => {
      await uploadBuffer("flyers/5.png", Buffer.from("x"), "image/png");

      expect(sendMock.mock.calls[0][0].input.Metadata).toEqual({});
    });

    test("propaga el error de R2 sin devolver una URL", async () => {
      sendMock.mockRejectedValue(new Error("R2 caído"));

      await expect(uploadBuffer("flyers/5.png", Buffer.from("x"), "image/png")).rejects.toThrow("R2 caído");
    });
  });
});
