import request from "supertest";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const getSignedUrlMock = jest.fn();

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

describe("POST /api/uploads/presign", () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.R2_ACCOUNT_ID = "test-account-id";
    process.env.R2_ACCESS_KEY_ID = "test-access-key-id";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-access-key";
    process.env.R2_BUCKET_NAME = "test-bucket";
    process.env.R2_ENDPOINT = "https://test-account-id.r2.cloudflarestorage.com";
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    getSignedUrlMock.mockReset();
    getSignedUrlMock.mockResolvedValue("https://test-account-id.r2.cloudflarestorage.com/test-bucket/signed?sig=abc");
  });

  // require app after env vars are set and mock is registered, so the S3Client
  // picks up the dummy R2 credentials/config from the start.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app } = require("../../src/app");

  test("responde 400 si contentType no está soportado", async () => {
    const res = await request(app)
      .post("/api/uploads/presign")
      .send({ fileName: "foto.gif", contentType: "image/gif" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  test("responde 400 si falta fileName o contentType", async () => {
    const res = await request(app).post("/api/uploads/presign").send({ fileName: "foto.jpg" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("responde 201 con uploadUrl, publicUrl y key para un input válido", async () => {
    const res = await request(app)
      .post("/api/uploads/presign")
      .send({ fileName: "foto.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(201);
    expect(res.body.uploadUrl).toBe(
      "https://test-account-id.r2.cloudflarestorage.com/test-bucket/signed?sig=abc"
    );
    expect(typeof res.body.key).toBe("string");
    expect(res.body.key).toMatch(/^pets\/[a-f0-9-]+\.jpg$/);
    expect(res.body.publicUrl).toBe(`https://pub-test.r2.dev/${res.body.key}`);

    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    const [, command] = getSignedUrlMock.mock.calls[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe("test-bucket");
    expect(command.input.Key).toBe(res.body.key);
    expect(command.input.ContentType).toBe("image/jpeg");
  });
});
