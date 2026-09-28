import request from "supertest";
import jwt from "jsonwebtoken";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const sendMock = jest.fn();

// Bucket falso en memoria: PutObject guarda la metadata y HeadObject la
// devuelve, o falla con el mismo shape que el SDK usa para un 404.
function installFakeBucket(): void {
  const objects = new Map<string, Record<string, string>>();
  sendMock.mockImplementation(async (command: unknown) => {
    if (command instanceof PutObjectCommand) {
      objects.set(command.input.Key as string, command.input.Metadata ?? {});
      return {};
    }
    if (command instanceof HeadObjectCommand) {
      const metadata = objects.get(command.input.Key as string);
      if (!metadata) {
        throw Object.assign(new Error("NotFound"), { name: "NotFound", $metadata: { httpStatusCode: 404 } });
      }
      return { Metadata: metadata };
    }
    throw new Error("Comando de S3 inesperado en el test");
  });
}

function putCalls(): PutObjectCommand[] {
  return sendMock.mock.calls
    .map(([command]) => command)
    .filter((command): command is PutObjectCommand => command instanceof PutObjectCommand);
}

jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  };
});

const R2_ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_ENDPOINT",
  "R2_PUBLIC_URL",
] as const;

// Restaura solo las claves de R2 (no todo process.env): un swap completo del
// objeto pisaba JWT_SECRET si el snapshot se tomó antes de que dotenv lo
// cargara (vía el require de ../../src/app más abajo), rompiendo el describe
// que corre a continuación en el mismo archivo.
function restoreR2Env(originalEnv: NodeJS.ProcessEnv): void {
  for (const key of R2_ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

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
    restoreR2Env(originalEnv);
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
    installFakeBucket();
  });

  test("responde 404 si el reporte no existe", async () => {
    const res = await request(app).get("/api/reports/999999999/flyer");

    expect(res.status).toBe(404);
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("responde 200 con flyerUrl y sube el PNG a R2 con la key esperada", async () => {
    const res = await request(app).get(`/api/reports/${reportId}/flyer`);

    expect(res.status).toBe(200);
    const puts = putCalls();
    const version = puts[0]?.input.Metadata?.["flyer-version"] ?? "";
    // URL versionada con la huella del contenido: la key es fija, el ?v= evita
    // que el navegador/CDN muestre un flyer viejo tras regenerarlo.
    expect(res.body.flyerUrl).toBe(
      `https://pub-test.r2.dev/flyers/report-${reportId}.png?v=${version.slice(0, 12)}`
    );

    expect(puts).toHaveLength(1);
    const command = puts[0];
    expect(command.input.Bucket).toBe("test-bucket");
    expect(command.input.Key).toBe(`flyers/report-${reportId}.png`);
    expect(command.input.ContentType).toBe("image/png");
    expect(Buffer.isBuffer(command.input.Body)).toBe(true);
    expect(command.input.Metadata?.["flyer-version"]).toMatch(/^[a-f0-9]{64}$/);
  });

  test("cache hit: una segunda request sin cambios en el reporte no vuelve a subir el PNG", async () => {
    const first = await request(app).get(`/api/reports/${reportId}/flyer`);
    expect(putCalls()).toHaveLength(1);

    const second = await request(app).get(`/api/reports/${reportId}/flyer`);

    expect(second.status).toBe(200);
    expect(second.body.flyerUrl).toBe(first.body.flyerUrl);
    expect(putCalls()).toHaveLength(1);
  });

  test("cache miss: si el dueño edita el título, la siguiente request regenera el PNG", async () => {
    await request(app).get(`/api/reports/${reportId}/flyer`);
    expect(putCalls()).toHaveLength(1);

    const edit = await request(app)
      .put(`/api/reports/${reportId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Gato gris perdido en San Telmo — recompensa" });
    expect(edit.status).toBe(200);

    const res = await request(app).get(`/api/reports/${reportId}/flyer`);

    expect(res.status).toBe(200);
    expect(putCalls()).toHaveLength(2);
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

  // Issue #180: un reporte pending/rejected solo lo ve su dueño. El flyer es
  // público, así que tiene que aplicar el mismo criterio que el detalle; si no,
  // cualquiera compone (y difunde) el flyer de un reporte no publicado.
  describe("visibilidad de reportes no publicados (mismo criterio que GET /api/reports/:id)", () => {
    let otherUserId: number;
    let otherToken: string;
    let privateReportId: number;

    beforeAll(async () => {
      const otherUser = await prisma.user.create({
        data: { email: `flyer-routes-test-other-${Date.now()}@example.com`, passwordHash: "test-hash" },
      });
      otherUserId = otherUser.id;
      otherToken = jwt.sign({ sub: otherUser.id, email: otherUser.email }, process.env.JWT_SECRET!, {
        expiresIn: "1h",
      });

      const report = await prisma.report.create({
        data: { userId, reportType: "lost", title: "Perro en moderación", status: "pending" },
      });
      privateReportId = report.id;
    });

    afterAll(async () => {
      await prisma.report.deleteMany({ where: { id: privateReportId } });
      await prisma.user.delete({ where: { id: otherUserId } });
    });

    const PRIVATE_STATUSES = ["pending", "rejected"] as const;

    test.each(PRIVATE_STATUSES)("reporte %s: un anónimo recibe 404 y no se genera nada", async (status) => {
      await prisma.report.update({ where: { id: privateReportId }, data: { status } });

      const res = await request(app).get(`/api/reports/${privateReportId}/flyer`);

      expect(res.status).toBe(404);
      expect(sendMock).not.toHaveBeenCalled();
    });

    test.each(PRIVATE_STATUSES)("reporte %s: otro usuario autenticado recibe 404", async (status) => {
      await prisma.report.update({ where: { id: privateReportId }, data: { status } });

      const res = await request(app)
        .get(`/api/reports/${privateReportId}/flyer`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
      expect(sendMock).not.toHaveBeenCalled();
    });

    test.each(PRIVATE_STATUSES)("reporte %s: el dueño sí obtiene su flyer", async (status) => {
      await prisma.report.update({ where: { id: privateReportId }, data: { status } });

      const res = await request(app)
        .get(`/api/reports/${privateReportId}/flyer`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.flyerUrl).toMatch(
        new RegExp(`^https://pub-test\\.r2\\.dev/flyers/report-${privateReportId}\\.png`)
      );
    });
  });
});

describe("PUT /api/reports/:id/flyer/custom", () => {
  const originalEnv = { ...process.env };
  let userId: number;
  let token: string;
  let otherUserId: number;
  let otherToken: string;
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
    restoreR2Env(originalEnv);
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app } = require("../../src/app");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prisma } = require("../../src/db/client");

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `custom-flyer-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;
    token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const otherUser = await prisma.user.create({
      data: { email: `custom-flyer-test-other-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    otherUserId = otherUser.id;
    otherToken = jwt.sign({ sub: otherUser.id, email: otherUser.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

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
    await prisma.user.delete({ where: { id: otherUserId } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
  });

  test("responde 401 sin token", async () => {
    const res = await request(app)
      .put(`/api/reports/${reportId}/flyer/custom`)
      .send({ flyerUrl: "https://cdn.example.com/mi-flyer.png" });

    expect(res.status).toBe(401);
  });

  test("responde 403 si el token es de otro usuario", async () => {
    const res = await request(app)
      .put(`/api/reports/${reportId}/flyer/custom`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ flyerUrl: "https://cdn.example.com/mi-flyer.png" });

    expect(res.status).toBe(403);
  });

  test("responde 404 si el reporte no existe", async () => {
    const res = await request(app)
      .put("/api/reports/999999999/flyer/custom")
      .set("Authorization", `Bearer ${token}`)
      .send({ flyerUrl: "https://cdn.example.com/mi-flyer.png" });

    expect(res.status).toBe(404);
  });

  test("responde 200, persiste customFlyerUrl y lo devuelve en el body", async () => {
    const res = await request(app)
      .put(`/api/reports/${reportId}/flyer/custom`)
      .set("Authorization", `Bearer ${token}`)
      .send({ flyerUrl: "https://cdn.example.com/mi-flyer.png" });

    expect(res.status).toBe(200);
    expect(res.body.customFlyerUrl).toBe("https://cdn.example.com/mi-flyer.png");
  });

  // El customFlyerUrl se renderiza como `<a href>` y `<img src>` en
  // ReportDetailPage.tsx, y lo ve cualquier visitante del reporte. Un esquema
  // `javascript:` persistido acá es XSS almacenado.
  test.each([
    ["javascript:", "javascript:fetch('//evil.example')"],
    ["data:", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
    ["vbscript:", "vbscript:msgbox(1)"],
    ["no es una URL", "no-es-una-url"],
  ])("responde 400 y no persiste un flyerUrl con esquema %s", async (_label, flyerUrl) => {
    const res = await request(app)
      .put(`/api/reports/${reportId}/flyer/custom`)
      .set("Authorization", `Bearer ${token}`)
      .send({ flyerUrl });

    expect(res.status).toBe(400);

    const stored = await request(app).get(`/api/reports/${reportId}`);
    expect(stored.body.customFlyerUrl).not.toBe(flyerUrl);
  });

  test("GET /:id/flyer devuelve el customFlyerUrl seteado sin regenerar el PNG automático", async () => {
    await request(app)
      .put(`/api/reports/${reportId}/flyer/custom`)
      .set("Authorization", `Bearer ${token}`)
      .send({ flyerUrl: "https://cdn.example.com/mi-flyer.png" });

    sendMock.mockReset();

    const res = await request(app).get(`/api/reports/${reportId}/flyer`);

    expect(res.status).toBe(200);
    expect(res.body.flyerUrl).toBe("https://cdn.example.com/mi-flyer.png");
    expect(sendMock).not.toHaveBeenCalled();
  });
});
