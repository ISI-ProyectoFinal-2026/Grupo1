import request from "supertest";
import jwt from "jsonwebtoken";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const sendMock = jest.fn();

jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  };
});

describe("GET /api/reports/:id/flyer", () => {
  const originalEnv = { ...process.env };
  let userId: number;
  let token: string;
  let reportId: number;

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

  // require después de fijar las env vars y el mock, mismo orden que
  // uploads.routes.test.ts, para que S3Client tome la config de una.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app } = require("../../src/app");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prisma } = require("../../src/db/client");

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `flyer-routes-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;
    token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        userId,
        reportType: "lost",
        title: "Gato gris perdido en San Telmo",
        description: "Collar rojo",
        location: { lat: -34.6037, lng: -58.3816 },
        locationAddress: "San Telmo, CABA",
      });
    reportId = res.body.id;
  });

  afterAll(async () => {
    await prisma.report.deleteMany({ where: { id: reportId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
  });

  test("responde 404 si el reporte no existe", async () => {
    const res = await request(app).get("/api/reports/999999999/flyer");

    expect(res.status).toBe(404);
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("responde 200 con flyerUrl y sube el PNG a R2 con la key esperada", async () => {
    const res = await request(app).get(`/api/reports/${reportId}/flyer`);

    expect(res.status).toBe(200);
    expect(res.body.flyerUrl).toBe(`https://pub-test.r2.dev/flyers/report-${reportId}.png`);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe("test-bucket");
    expect(command.input.Key).toBe(`flyers/report-${reportId}.png`);
    expect(command.input.ContentType).toBe("image/png");
    expect(Buffer.isBuffer(command.input.Body)).toBe(true);
  });

  test("no requiere autenticación (el flyer es de un reporte ya público)", async () => {
    const res = await request(app).get(`/api/reports/${reportId}/flyer`);
    expect(res.status).toBe(200);
  });

  test("responde 503 y no intenta subir nada si R2 no está configurado", async () => {
    const savedBucket = process.env.R2_BUCKET_NAME;
    delete process.env.R2_BUCKET_NAME;

    const res = await request(app).get(`/api/reports/${reportId}/flyer`);

    expect(res.status).toBe(503);
    expect(sendMock).not.toHaveBeenCalled();

    process.env.R2_BUCKET_NAME = savedBucket;
  });
});
