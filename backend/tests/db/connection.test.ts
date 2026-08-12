import { prisma } from "../../src/db/client";

describe("Database Connection Tests", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("debe conectarse exitosamente a PostgreSQL", async () => {
    const result = await prisma.$queryRaw`SELECT 1`;
    expect(result).toBeDefined();
  });

  test("debe verificar que PostGIS esté activo", async () => {
    const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'postgis'
    `;
    expect(extensions.length).toBeGreaterThan(0);
    expect(extensions[0].extname).toBe("postgis");
  });

  test("debe verificar que pgvector esté activo", async () => {
    const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    expect(extensions.length).toBeGreaterThan(0);
    expect(extensions[0].extname).toBe("vector");
  });

  test("debe crear y consultar un usuario en la tabla users", async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: "test-hash",
        fullName: "Test User",
      },
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();

    await prisma.user.delete({ where: { id: user.id } });
  });

  test("debe verificar estructura de tabla reports con PostGIS", async () => {
    const columns = await prisma.$queryRaw<
      Array<{ column_name: string; udt_name: string }>
    >`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name = 'reports'
    `;

    const locationCol = columns.find((c) => c.column_name === "location");
    expect(locationCol).toBeDefined();
    expect(locationCol?.udt_name).toBe("geometry");
  });

  test("debe verificar estructura de tabla report_embeddings con pgvector", async () => {
    const columns = await prisma.$queryRaw<
      Array<{ column_name: string; udt_name: string }>
    >`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name = 'report_embeddings'
    `;

    const embeddingCol = columns.find((c) => c.column_name === "embedding");
    expect(embeddingCol).toBeDefined();
    expect(embeddingCol?.udt_name).toBe("vector");
  });

  test("debe validar relaciones y foreign keys", async () => {
    const fks = await prisma.$queryRaw<
      Array<{ constraint_name: string; table_name: string }>
    >`
      SELECT constraint_name, table_name
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY'
    `;

    expect(fks.length).toBeGreaterThan(0);
  });

  test("debe verificar índices en tablas principales", async () => {
    const indices = await prisma.$queryRaw<
      Array<{ indexname: string; tablename: string }>
    >`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE tablename IN ('reports', 'report_embeddings', 'report_matches')
    `;

    expect(indices.length).toBeGreaterThan(0);
  });
});
