import { Prisma } from "@prisma/client";
import { prisma } from "../../src/db/client";
import * as notificationsService from "../../src/services/notifications.service";
import { findAndStoreMatches, saveReportEmbedding } from "../../src/services/report-matching.service";
import { createTestUser } from "../helpers/users";

// Port de backend-ia/tests/test_matching_service.py y de los casos de persistencia
// de test_embedding_service.py (#307): contra la base real, sembrando por SQL crudo.

const EMBEDDING_DIM = 768;
const NEAR = { lat: -34.6037, lng: -58.3816 }; // Plaza de Mayo, CABA
const FAR = { lat: -34.6037, lng: -57.9 }; // ~40 km al este, fuera del radio de 5 km

// vector unitario cuya similitud coseno con EMBEDDING_BASE es exactamente `cosine`
const unitVectorAtCosine = (cosine: number): number[] => [
  cosine,
  Math.sqrt(1 - cosine ** 2),
  ...Array<number>(EMBEDDING_DIM - 2).fill(0),
];

// Regresión: con vectores idénticos el test pasaría con cualquier métrica; con
// `<->` (L2) el par de coseno 0.70 da 0.23 de "similitud" y no matchea.
const EMBEDDING_BASE = unitVectorAtCosine(1);
const EMBEDDING_MISMA_MASCOTA = unitVectorAtCosine(0.7);
const EMBEDDING_POSIBLE_MASCOTA = unitVectorAtCosine(0.5);
const EMBEDDING_OTRA_MASCOTA = unitVectorAtCosine(0.2);

const vectorLiteral = (values: number[]) => `[${values.join(",")}]`;

// pgvector guarda float32: se compara con tolerancia
function expectVectorCloseTo(stored: string, expected: number[]) {
  const values = JSON.parse(stored) as number[];
  expect(values).toHaveLength(expected.length);
  values.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 6));
}

const MATCH_ENV_VARS = ["MATCH_THRESHOLD", "NOTIFY_THRESHOLD", "MATCH_RADIUS_METERS", "MATCH_WINDOW_DAYS", "MATCH_TOP_K"];

const userIds: number[] = [];
const reportIds: number[] = [];

async function createUser(prefix: string): Promise<number> {
  const { user } = await createTestUser({ prefix });
  userIds.push(user.id);
  return user.id;
}

async function insertReport(
  userId: number,
  reportType: "lost" | "found",
  { lat, lng }: { lat: number; lng: number },
  ageDays = 0
): Promise<number> {
  const [{ id }] = await prisma.$queryRaw<{ id: number }[]>`
    INSERT INTO reports (user_id, report_type, status, title, location, created_at, updated_at)
    VALUES (
      ${userId}, CAST(${reportType} AS report_type), 'published'::report_status, 'Test report',
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326), now() - make_interval(days => ${ageDays}::int), now()
    )
    RETURNING id
  `;
  reportIds.push(id);
  return id;
}

async function insertEmbedding(reportId: number, embedding: number[]): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO report_embeddings (report_id, embedding, created_at)
    VALUES (${reportId}, ${vectorLiteral(embedding)}::vector, now())
  `;
}

async function insertReportWithEmbedding(
  userId: number,
  reportType: "lost" | "found",
  embedding: number[],
  location = NEAR,
  ageDays = 0
): Promise<number> {
  const id = await insertReport(userId, reportType, location, ageDays);
  await insertEmbedding(id, embedding);
  return id;
}

// filas de report_matches de estos reportes (la base compartida puede tener otras)
const matchesOf = (ids: number[]) =>
  prisma.reportMatch.findMany({
    where: { OR: [{ reportLostId: { in: ids } }, { reportFoundId: { in: ids } }] },
    select: { reportLostId: true, reportFoundId: true, similarityScore: true, status: true },
  });

let notifySpy: jest.SpyInstance;

beforeEach(() => {
  notifySpy = jest.spyOn(notificationsService, "notifyMatch").mockResolvedValue([]);
  for (const name of MATCH_ENV_VARS) delete process.env[name];
});

afterEach(async () => {
  jest.restoreAllMocks();
  for (const name of MATCH_ENV_VARS) delete process.env[name];
  const ids = reportIds.splice(0);
  // report_matches y report_embeddings caen en cascada con el reporte
  await prisma.report.deleteMany({ where: { id: { in: ids } } });
  await prisma.accountSanction.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("findAndStoreMatches: escenario con decoys", () => {
  let s: {
    foundId: number;
    lostMatchId: number;
    lostPosibleId: number;
    lostBajaSimilitudId: number;
    foundMismoTipoId: number;
    lostFueraDeRadioId: number;
    lostFueraDeRecenciaId: number;
  };
  const scenarioIds = () => Object.values(s);

  beforeEach(async () => {
    const userId = await createUser("matching-scenario");
    s = {
      foundId: await insertReportWithEmbedding(userId, "found", EMBEDDING_BASE),
      lostMatchId: await insertReportWithEmbedding(userId, "lost", EMBEDDING_MISMA_MASCOTA),
      lostPosibleId: await insertReportWithEmbedding(userId, "lost", EMBEDDING_POSIBLE_MASCOTA),
      lostBajaSimilitudId: await insertReportWithEmbedding(userId, "lost", EMBEDDING_OTRA_MASCOTA),
      foundMismoTipoId: await insertReportWithEmbedding(userId, "found", EMBEDDING_MISMA_MASCOTA),
      lostFueraDeRadioId: await insertReportWithEmbedding(userId, "lost", EMBEDDING_MISMA_MASCOTA, FAR),
      lostFueraDeRecenciaId: await insertReportWithEmbedding(userId, "lost", EMBEDDING_MISMA_MASCOTA, NEAR, 100),
    };
  });

  test("crea match para candidatos sobre el umbral, opuestos, cerca y recientes", async () => {
    await expect(findAndStoreMatches(s.foundId)).resolves.toBe(2);

    const rows = await matchesOf(scenarioIds());
    const byLost = new Map(rows.map((row) => [row.reportLostId, row]));
    expect([...byLost.keys()].sort()).toEqual([s.lostMatchId, s.lostPosibleId].sort());
    expect(rows.every((row) => row.reportFoundId === s.foundId && row.status === "pending")).toBe(true);
    expect(byLost.get(s.lostMatchId)!.similarityScore).toBeCloseTo(0.7, 4);
    expect(byLost.get(s.lostPosibleId)!.similarityScore).toBeCloseTo(0.5, 4);
  });

  test("notifica solo los matches sobre el umbral de notificación", async () => {
    await findAndStoreMatches(s.foundId);

    expect(notifySpy).toHaveBeenCalledTimes(1);
    const [args] = notifySpy.mock.calls[0];
    expect(args).toMatchObject({ lostReportId: s.lostMatchId, foundReportId: s.foundId });
    expect(args.similarityScore).toBeCloseTo(0.7, 4);
  });

  test("no crea match para los decoys", async () => {
    await findAndStoreMatches(s.foundId);

    const decoys = [s.lostBajaSimilitudId, s.foundMismoTipoId, s.lostFueraDeRadioId, s.lostFueraDeRecenciaId];
    const involved = (await matchesOf(scenarioIds())).flatMap((row) => [row.reportLostId, row.reportFoundId]);
    expect(involved.filter((id) => decoys.includes(id))).toEqual([]);
  });

  test("correr dos veces no duplica", async () => {
    await expect(findAndStoreMatches(s.foundId)).resolves.toBe(2);
    // siguen pending: se actualizan sin duplicar
    await expect(findAndStoreMatches(s.foundId)).resolves.toBe(2);
    await expect(matchesOf(scenarioIds())).resolves.toHaveLength(2);
  });

  test("no pisa un match ya confirmado", async () => {
    await findAndStoreMatches(s.foundId);
    await prisma.reportMatch.updateMany({
      where: { reportLostId: s.lostMatchId, reportFoundId: s.foundId },
      data: { status: "confirmed", similarityScore: 0.42 },
    });

    // solo el "posible", que sigue pending
    await expect(findAndStoreMatches(s.foundId)).resolves.toBe(1);

    const confirmed = (await matchesOf(scenarioIds())).find((row) => row.reportLostId === s.lostMatchId)!;
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.similarityScore).toBeCloseTo(0.42, 6);
  });

  test("el top se lee de la configuración", async () => {
    process.env.MATCH_TOP_K = "1";

    await expect(findAndStoreMatches(s.foundId)).resolves.toBe(1);
    expect((await matchesOf(scenarioIds())).map((row) => row.reportLostId)).toEqual([s.lostMatchId]);
  });

  test("un fallo al notificar se loguea y no corta el matching", async () => {
    const error = new Error("notificaciones caídas");
    notifySpy.mockRejectedValue(error);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(findAndStoreMatches(s.foundId)).resolves.toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("no se pudo notificar el match"), error);
  });
});

describe("findAndStoreMatches: sanciones y reportes ocultos", () => {
  let pair: { sourceUserId: number; candidateUserId: number; foundId: number; lostId: number };

  beforeEach(async () => {
    const sourceUserId = await createUser("matching-source");
    const candidateUserId = await createUser("matching-candidate");
    pair = {
      sourceUserId,
      candidateUserId,
      foundId: await insertReportWithEmbedding(sourceUserId, "found", EMBEDDING_BASE),
      lostId: await insertReportWithEmbedding(candidateUserId, "lost", EMBEDDING_MISMA_MASCOTA),
    };
  });

  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;

  async function sanction(userId: number, status: "active" | "pending_review" | "reverted", endsAt: Date | null) {
    await prisma.accountSanction.create({
      data: {
        userId,
        severity: "mild",
        kind: "temporary",
        status,
        reason: "test",
        startsAt: new Date(Date.now() - DAY),
        endsAt,
      },
    });
  }

  const pairMatches = () => matchesOf([pair.foundId, pair.lostId]);

  test.each([
    ["permanente", null],
    ["temporal vigente", 7 * DAY],
  ])("excluye candidatos de autores suspendidos (%s)", async (_label, endsInMs) => {
    await sanction(pair.candidateUserId, "active", endsInMs === null ? null : new Date(Date.now() + endsInMs));

    await expect(findAndStoreMatches(pair.foundId)).resolves.toBe(0);
    await expect(pairMatches()).resolves.toEqual([]);
    expect(notifySpy).not.toHaveBeenCalled();
  });

  test("no busca matches si el autor del origen está suspendido", async () => {
    await sanction(pair.sourceUserId, "active", null);

    await expect(findAndStoreMatches(pair.foundId)).resolves.toBe(0);
    await expect(pairMatches()).resolves.toEqual([]);
    expect(notifySpy).not.toHaveBeenCalled();
  });

  // reporte oculto por denuncias (#218)
  test("excluye candidatos ocultos por denuncias", async () => {
    await prisma.report.update({ where: { id: pair.lostId }, data: { status: "hidden" } });

    await expect(findAndStoreMatches(pair.foundId)).resolves.toBe(0);
    await expect(pairMatches()).resolves.toEqual([]);
    expect(notifySpy).not.toHaveBeenCalled();
  });

  test.each([
    ["candidato vencida", "candidateUserId", "active", -HOUR],
    ["origen vencida", "sourceUserId", "active", -HOUR],
    ["candidato pending_review", "candidateUserId", "pending_review", null],
    ["candidato revertida", "candidateUserId", "reverted", null],
  ] as const)("sanciones no vigentes no excluyen (%s)", async (_label, userKey, status, endsInMs) => {
    await sanction(pair[userKey], status, endsInMs === null ? null : new Date(Date.now() + endsInMs));

    await expect(findAndStoreMatches(pair.foundId)).resolves.toBe(1);
    expect((await pairMatches()).map((row) => [row.reportLostId, row.reportFoundId])).toEqual([
      [pair.lostId, pair.foundId],
    ]);
  });
});

// parámetros configurables (#217)
describe("findAndStoreMatches: parámetros de configuración", () => {
  async function seedPair({ ageDays = 1, cosine = 0.7, lat = NEAR.lat } = {}) {
    const userId = await createUser("matching-config");
    const foundId = await insertReportWithEmbedding(userId, "found", EMBEDDING_BASE);
    const lostId = await insertReportWithEmbedding(userId, "lost", unitVectorAtCosine(cosine), { lat, lng: NEAR.lng }, ageDays);
    return { foundId, lostId };
  }

  test("matchea un candidato de 60 días con la ventana por defecto", async () => {
    const { foundId } = await seedPair({ ageDays: 60 });
    await expect(findAndStoreMatches(foundId)).resolves.toBe(1);
  });

  test("no matchea un candidato más viejo que la ventana por defecto", async () => {
    const { foundId } = await seedPair({ ageDays: 100 });
    await expect(findAndStoreMatches(foundId)).resolves.toBe(0);
  });

  test("la ventana se lee de la configuración", async () => {
    process.env.MATCH_WINDOW_DAYS = "30";
    const { foundId } = await seedPair({ ageDays: 60 });
    await expect(findAndStoreMatches(foundId)).resolves.toBe(0);
  });

  test("el umbral de match se lee de la configuración", async () => {
    process.env.MATCH_THRESHOLD = "0.80";
    const { foundId } = await seedPair({ cosine: 0.7 });
    await expect(findAndStoreMatches(foundId)).resolves.toBe(0);
  });

  test("el umbral de notificación se lee de la configuración", async () => {
    process.env.NOTIFY_THRESHOLD = "0.90";
    const { foundId } = await seedPair({ cosine: 0.7 });
    await expect(findAndStoreMatches(foundId)).resolves.toBe(1);
    expect(notifySpy).not.toHaveBeenCalled();
  });

  test("el radio se lee de la configuración", async () => {
    // 0.01 grados de latitud ≈ 1.1 km: dentro de 5 km, fuera de 500 m
    process.env.MATCH_RADIUS_METERS = "500";
    const { foundId } = await seedPair({ lat: NEAR.lat + 0.01 });
    await expect(findAndStoreMatches(foundId)).resolves.toBe(0);
  });
});

describe("saveReportEmbedding", () => {
  const IMAGE_URL = "https://pub-test.r2.dev/pets/foto.jpg";
  let reportId: number;

  const storedEmbeddings = () =>
    prisma.$queryRaw<{ embedding: string }[]>(
      Prisma.sql`SELECT embedding::text AS embedding FROM report_embeddings WHERE report_id = ${reportId}`
    );

  beforeEach(async () => {
    const userId = await createUser("embedding-save");
    const report = await prisma.report.create({
      data: { userId, reportType: "found", status: "pending", title: "Test report", imageUrl: IMAGE_URL },
    });
    reportIds.push(report.id);
    reportId = report.id;
  });

  test("inserta el embedding del reporte", async () => {
    await expect(saveReportEmbedding(reportId, IMAGE_URL, EMBEDDING_BASE)).resolves.toBe(true);

    const rows = await storedEmbeddings();
    expect(rows).toHaveLength(1);
    expectVectorCloseTo(rows[0].embedding, EMBEDDING_BASE);
  });

  test("llamado dos veces actualiza en vez de fallar", async () => {
    await expect(saveReportEmbedding(reportId, IMAGE_URL, EMBEDDING_BASE)).resolves.toBe(true);
    await expect(saveReportEmbedding(reportId, IMAGE_URL, EMBEDDING_MISMA_MASCOTA)).resolves.toBe(true);

    const rows = await storedEmbeddings();
    expect(rows).toHaveLength(1);
    expectVectorCloseTo(rows[0].embedding, EMBEDDING_MISMA_MASCOTA);
  });

  // el dueño cambió la foto con la inferencia en vuelo
  test("no guarda nada si el reporte ya no muestra la imagen analizada", async () => {
    await expect(
      saveReportEmbedding(reportId, "https://pub-test.r2.dev/pets/foto-vieja.jpg", EMBEDDING_BASE)
    ).resolves.toBe(false);

    await expect(storedEmbeddings()).resolves.toEqual([]);
  });
});
