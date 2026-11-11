import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as reportsService from "../../src/services/reports.service";
import * as matchingService from "../../src/services/matching.service";
import * as notificationsService from "../../src/services/notifications.service";
import { nearby, withinBounds } from "../../src/services/geo.service";
import { findSimilarReports } from "../../src/services/similar-reports.service";
import { createTestUser } from "../helpers/users";

// Punto lejos de los datos de desarrollo (Ushuaia)
const CENTER = { lat: -54.8019, lng: -68.303 };

describe("reportes ocultos por denuncias (#218)", () => {
  let ownerId: number;
  let ownerToken: string;
  let otherId: number;
  let otherToken: string;
  const flaggerIds: number[] = [];
  const reportIds: number[] = [];

  async function createReport(status: "published" | "hidden", title = "Oculto de prueba") {
    const report = await prisma.report.create({
      data: { userId: ownerId, reportType: "found", status, title, imageUrl: "https://cdn.example.com/a.jpg" },
    });
    reportIds.push(report.id);
    await prisma.$executeRaw`
      UPDATE reports SET location = ST_SetSRID(ST_MakePoint(${CENTER.lng}, ${CENTER.lat}), 4326) WHERE id = ${report.id}
    `;
    return report.id;
  }

  async function addFlag(reportId: number, reason: "spam" | "offensive" | "other", cycle = 0) {
    const flagger = (await createTestUser({ prefix: "hidden-flagger" })).user.id;
    flaggerIds.push(flagger);
    await prisma.reportFlag.create({
      data: { reportId, userId: flagger, reason, detail: reason === "other" ? "texto privado" : null, cycle },
    });
  }

  beforeAll(async () => {
    const owner = await createTestUser({ prefix: "hidden-owner" });
    ownerId = owner.user.id;
    ownerToken = owner.token;
    const other = await createTestUser({ prefix: "hidden-other" });
    otherId = other.user.id;
    otherToken = other.token;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.report.deleteMany({ where: { id: { in: reportIds.splice(0) } } });
    await prisma.user.deleteMany({ where: { id: { in: flaggerIds.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await prisma.$disconnect();
  });

  describe("visibilidad", () => {
    test("el feed por defecto no lo incluye", async () => {
      const id = await createReport("hidden");
      const feed = await reportsService.list({}, otherId);
      expect(feed.map((r) => r.id)).not.toContain(id);
    });

    test("status=hidden solo lo lista a su dueño; anónimos y terceros reciben []", async () => {
      const id = await createReport("hidden");

      expect(await reportsService.list({ status: "hidden" })).toEqual([]);
      expect((await reportsService.list({ status: "hidden" }, otherId)).map((r) => r.id)).not.toContain(id);
      expect((await reportsService.list({ status: "hidden" }, ownerId)).map((r) => r.id)).toContain(id);
    });

    test("GET /api/reports acepta status=hidden", async () => {
      const id = await createReport("hidden");

      const asOwner = await request(app).get("/api/reports?status=hidden").set("Authorization", `Bearer ${ownerToken}`);
      expect(asOwner.status).toBe(200);
      expect(asOwner.body.map((r: { id: number }) => r.id)).toContain(id);

      const anonymous = await request(app).get("/api/reports?status=hidden");
      expect(anonymous.status).toBe(200);
      expect(anonymous.body).toEqual([]);
    });

    test("el mapa (nearby y withinBounds) no lo incluye y sí el publicado", async () => {
      const hidden = await createReport("hidden");
      const published = await createReport("published", "Publicado de prueba");

      const near = (await nearby(CENTER.lat, CENTER.lng, 2)).map((r) => r.id);
      const bounded = (
        await withinBounds({ swLat: CENTER.lat - 0.01, swLng: CENTER.lng - 0.01, neLat: CENTER.lat + 0.01, neLng: CENTER.lng + 0.01 })
      ).map((r) => r.id);

      for (const ids of [near, bounded]) {
        expect(ids).toContain(published);
        expect(ids).not.toContain(hidden);
      }
    });

    test("los similares no lo incluyen", async () => {
      const hidden = await createReport("hidden");
      const published = await createReport("published", "Publicado de prueba");

      const similar = await findSimilarReports({ reportType: "found", location: CENTER }, otherId);

      expect(similar.map((r) => r.id)).toContain(published);
      expect(similar.map((r) => r.id)).not.toContain(hidden);
    });

    test("detalle y flyer: 404 para terceros y anónimos, 200 para el dueño", async () => {
      const id = await createReport("hidden");
      const detail = (token?: string) => {
        const req = request(app).get(`/api/reports/${id}`);
        return token ? req.set("Authorization", `Bearer ${token}`) : req;
      };

      expect((await detail()).status).toBe(404);
      expect((await detail(otherToken)).status).toBe(404);
      expect((await detail(ownerToken)).status).toBe(200);

      expect((await request(app).get(`/api/reports/${id}/flyer`)).status).toBe(404);
      expect((await request(app).get(`/api/reports/${id}/flyer`).set("Authorization", `Bearer ${otherToken}`)).status).toBe(404);
    });

    test("no genera avisos de zona", async () => {
      const id = await createReport("hidden");
      await expect(notificationsService.createForNearbyReport(id)).resolves.toEqual([]);
    });

    test("el chat existente sigue funcionando", async () => {
      const id = await createReport("hidden");
      const [userAId, userBId] = ownerId < otherId ? [ownerId, otherId] : [otherId, ownerId];
      const chat = await prisma.chat.create({ data: { userAId, userBId, reportId: id } });

      const res = await request(app)
        .post(`/api/chats/${chat.id}/messages`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ content: "Hola, sigo interesado" });

      expect(res.status).toBe(201);
      await prisma.message.deleteMany({ where: { chatId: chat.id } });
      await prisma.notification.deleteMany({ where: { reportId: id } });
      await prisma.chat.delete({ where: { id: chat.id } });
    });
  });

  describe("límites del dueño", () => {
    test("update() responde 409 y no cambia nada", async () => {
      const id = await createReport("hidden");

      await expect(reportsService.update(id, ownerId, { title: "Nuevo título" })).rejects.toMatchObject({
        statusCode: 409,
      });

      const report = await prisma.report.findUniqueOrThrow({ where: { id } });
      expect(report).toMatchObject({ title: "Oculto de prueba", status: "hidden", contentEditedAt: null });
    });

    test("subir una foto nueva se rechaza, sigue hidden y no dispara la IA", async () => {
      const id = await createReport("hidden");
      const trigger = jest.spyOn(matchingService, "triggerEmbeddingGeneration").mockResolvedValue(undefined);

      await expect(
        reportsService.update(id, ownerId, { imageUrl: "https://cdn.example.com/nueva.jpg" })
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(trigger).not.toHaveBeenCalled();
      expect((await prisma.report.findUniqueOrThrow({ where: { id } })).status).toBe("hidden");
    });

    test("close() responde 409 y deja el reporte hidden", async () => {
      const id = await createReport("hidden");

      await expect(reportsService.close(id, ownerId)).rejects.toMatchObject({ statusCode: 409 });
      expect((await prisma.report.findUniqueOrThrow({ where: { id } })).status).toBe("hidden");
    });

    test("remove() lo elimina", async () => {
      const id = await createReport("hidden");

      await reportsService.remove(id, ownerId);

      expect(await prisma.report.findUnique({ where: { id } })).toBeNull();
    });

    test("una edición exitosa de un publicado sella contentEditedAt", async () => {
      const id = await createReport("published");
      const before = Date.now();

      await reportsService.update(id, ownerId, { title: "Título editado" });

      const report = await prisma.report.findUniqueOrThrow({ where: { id } });
      expect(report.contentEditedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    });
  });

  describe("hiddenReasons", () => {
    test("listOwned y el detalle del dueño agrupan los motivos del ciclo actual sin detalle ni denunciante", async () => {
      const id = await createReport("hidden");
      await addFlag(id, "spam");
      await addFlag(id, "spam");
      await addFlag(id, "other");

      const owned = (await reportsService.listOwned(ownerId)).find((r) => r.id === id);
      const detail = await reportsService.getVisibleById(id, ownerId);

      for (const dto of [owned, detail]) {
        expect(dto?.hiddenReasons).toEqual(
          expect.arrayContaining([
            { reason: "spam", count: 2 },
            { reason: "other", count: 1 },
          ])
        );
        expect(dto?.hiddenReasons).toHaveLength(2);
        expect(JSON.stringify(dto?.hiddenReasons)).not.toContain("texto privado");
      }
    });

    test("ignora las denuncias de ciclos anteriores", async () => {
      const id = await createReport("hidden");
      await prisma.report.update({ where: { id }, data: { flagCycle: 1 } });
      await addFlag(id, "offensive", 0);
      await addFlag(id, "spam", 1);

      const detail = await reportsService.getVisibleById(id, ownerId);

      expect(detail.hiddenReasons).toEqual([{ reason: "spam", count: 1 }]);
    });

    test("un reporte publicado no lleva hiddenReasons", async () => {
      const id = await createReport("published");
      const detail = await reportsService.getVisibleById(id, ownerId);
      expect(detail.hiddenReasons).toBeUndefined();
    });
  });
});
