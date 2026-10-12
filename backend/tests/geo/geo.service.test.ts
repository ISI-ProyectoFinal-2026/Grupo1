import { prisma } from "../../src/db/client";
import { nearby, withinBounds } from "../../src/services/geo.service";

// Punto lejos de los datos de desarrollo (Ushuaia). 0.009 grados de latitud ~ 1 km.
const CENTER = { lat: -54.8019, lng: -68.303 };

describe("geo.service nearby / withinBounds", () => {
  let userId: number;
  const reportIds: number[] = [];

  async function createReport(
    title: string,
    offsetLat: number | null,
    opts: { status?: "published" | "pending" | "rejected"; createdAt?: Date } = {}
  ) {
    const report = await prisma.report.create({
      data: {
        userId,
        reportType: "found",
        status: opts.status ?? "published",
        title,
        createdAt: opts.createdAt,
      },
    });
    reportIds.push(report.id);
    if (offsetLat !== null) {
      await prisma.$executeRaw`
        UPDATE reports
        SET location = ST_SetSRID(ST_MakePoint(${CENTER.lng}, ${CENTER.lat + offsetLat}), 4326)
        WHERE id = ${report.id}
      `;
    }
    return report.id;
  }

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `geo-service-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.report.deleteMany({ where: { id: { in: reportIds.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  describe("nearby", () => {
    test("interpreta el radio en kilómetros: incluye lo cercano y excluye lo lejano", async () => {
      const cerca = await createReport("A 1.5 km", 0.0135);
      const lejos = await createReport("A 5 km", 0.045);

      const result = await nearby(CENTER.lat, CENTER.lng, 2);

      const ids = result.map((r) => r.id);
      expect(ids).toContain(cerca);
      expect(ids).not.toContain(lejos);
    });

    test("al ampliar el radio entra el reporte que antes quedaba afuera", async () => {
      const lejos = await createReport("A 5 km", 0.045);

      const chico = await nearby(CENTER.lat, CENTER.lng, 2);
      const grande = await nearby(CENTER.lat, CENTER.lng, 10);

      expect(chico.map((r) => r.id)).not.toContain(lejos);
      expect(grande.map((r) => r.id)).toContain(lejos);
    });

    test("solo devuelve reportes publicados", async () => {
      const publicado = await createReport("Publicado", 0.001);
      const pendiente = await createReport("Pendiente", 0.001, { status: "pending" });
      const rechazado = await createReport("Rechazado", 0.001, { status: "rejected" });

      const ids = (await nearby(CENTER.lat, CENTER.lng, 1)).map((r) => r.id);

      expect(ids).toContain(publicado);
      expect(ids).not.toContain(pendiente);
      expect(ids).not.toContain(rechazado);
    });

    test("ignora los reportes sin ubicación", async () => {
      const sinUbicacion = await createReport("Sin ubicación", null);

      const ids = (await nearby(CENTER.lat, CENTER.lng, 1000)).map((r) => r.id);

      expect(ids).not.toContain(sinUbicacion);
    });

    test("ordena del más nuevo al más viejo", async () => {
      const viejo = await createReport("Viejo", 0.001, { createdAt: new Date("2026-01-01T10:00:00Z") });
      const nuevo = await createReport("Nuevo", 0.002, { createdAt: new Date("2026-02-01T10:00:00Z") });

      const ids = (await nearby(CENTER.lat, CENTER.lng, 1)).map((r) => r.id);

      expect(ids.indexOf(nuevo)).toBeLessThan(ids.indexOf(viejo));
    });

    test("devuelve las coordenadas como lat/lng en el DTO", async () => {
      const id = await createReport("Con coordenadas", 0.001);

      const result = await nearby(CENTER.lat, CENTER.lng, 1);

      const found = result.find((r) => r.id === id);
      expect(found?.location?.lat).toBeCloseTo(CENTER.lat + 0.001, 5);
      expect(found?.location?.lng).toBeCloseTo(CENTER.lng, 5);
    });

    test("devuelve un arreglo vacío si no hay reportes en el radio", async () => {
      // antípoda del centro: no hay datos allí
      await expect(nearby(54.8019, 111.697, 1)).resolves.toEqual([]);
    });
  });

  describe("withinBounds", () => {
    const bounds = {
      swLat: CENTER.lat - 0.01,
      swLng: CENTER.lng - 0.01,
      neLat: CENTER.lat + 0.01,
      neLng: CENTER.lng + 0.01,
    };

    test("incluye los reportes dentro del bounding box y excluye los de afuera", async () => {
      const dentro = await createReport("Dentro", 0.005);
      const fuera = await createReport("Fuera", 0.02);

      const ids = (await withinBounds(bounds)).map((r) => r.id);

      expect(ids).toContain(dentro);
      expect(ids).not.toContain(fuera);
    });

    test("solo devuelve reportes publicados", async () => {
      const publicado = await createReport("Publicado", 0.005);
      const pendiente = await createReport("Pendiente", 0.005, { status: "pending" });

      const ids = (await withinBounds(bounds)).map((r) => r.id);

      expect(ids).toContain(publicado);
      expect(ids).not.toContain(pendiente);
    });

    test("ignora los reportes sin ubicación", async () => {
      const sinUbicacion = await createReport("Sin ubicación", null);

      const ids = (await withinBounds(bounds)).map((r) => r.id);

      expect(ids).not.toContain(sinUbicacion);
    });

    test("devuelve las coordenadas como lat/lng en el DTO", async () => {
      const id = await createReport("Con coordenadas", 0.005);

      const found = (await withinBounds(bounds)).find((r) => r.id === id);

      expect(found?.location?.lat).toBeCloseTo(CENTER.lat + 0.005, 5);
      expect(found?.location?.lng).toBeCloseTo(CENTER.lng, 5);
    });

    test("devuelve un arreglo vacío si el box no contiene reportes", async () => {
      await createReport("Dentro de otro lado", 0.005);

      await expect(
        withinBounds({ swLat: 10, swLng: 10, neLat: 10.01, neLng: 10.01 })
      ).resolves.toEqual([]);
    });
  });
});
