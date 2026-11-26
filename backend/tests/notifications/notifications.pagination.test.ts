import request from "supertest";
import { createTestUser } from "../helpers/users";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

// paginado keyset de GET /api/notifications y contador de no leídas (#338)
describe("/api/notifications paginado (#338)", () => {
  let userId: number;
  let token: string;
  let emptyToken: string;
  let emptyUserId: number;
  // ids en el orden esperado: más nueva primero
  let expectedOrder: number[];

  beforeAll(async () => {
    const owner = await createTestUser({ prefix: "notifications-pagination" });
    userId = owner.user.id;
    token = owner.token;

    const empty = await createTestUser({ prefix: "notifications-pagination-empty" });
    emptyUserId = empty.user.id;
    emptyToken = empty.token;

    // dos con la misma fecha: el desempate por id evita saltos y repetidos entre páginas
    const tied = new Date("2024-03-01T00:00:00.000Z");
    const dates = [
      new Date("2024-01-01T00:00:00.000Z"),
      tied,
      tied,
      new Date("2024-05-01T00:00:00.000Z"),
      new Date("2024-07-01T00:00:00.000Z"),
    ];
    const created = [];
    for (const [index, createdAt] of dates.entries()) {
      created.push(
        await prisma.notification.create({
          data: { userId, type: "message", title: `n${index}`, isRead: index % 2 === 0, createdAt },
        })
      );
    }
    expectedOrder = [...created]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
      .map((n) => n.id);
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: [userId, emptyUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, emptyUserId] } } });
    await prisma.$disconnect();
  });

  function list(query: object, authToken = token) {
    return request(app).get("/api/notifications").query(query).set("Authorization", `Bearer ${authToken}`);
  }

  test("primera página: respeta limit y devuelve nextCursor", async () => {
    const res = await list({ limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.items.map((n: { id: number }) => n.id)).toEqual(expectedOrder.slice(0, 2));
    expect(typeof res.body.nextCursor).toBe("string");
  });

  test("página siguiente y fin de lista: recorre todo sin repetir ni saltear", async () => {
    const page1 = await list({ limit: 2 });
    const page2 = await list({ limit: 2, cursor: page1.body.nextCursor });
    const page3 = await list({ limit: 2, cursor: page2.body.nextCursor });

    expect(page2.status).toBe(200);
    expect(page2.body.items.map((n: { id: number }) => n.id)).toEqual(expectedOrder.slice(2, 4));
    expect(page3.body.items.map((n: { id: number }) => n.id)).toEqual(expectedOrder.slice(4));
    expect(page3.body.nextCursor).toBeNull();
  });

  test("sin limit usa 20 por defecto", async () => {
    const res = await list({});

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(expectedOrder.length);
    expect(res.body.nextCursor).toBeNull();
  });

  test("lista vacía: items vacío y nextCursor null", async () => {
    const res = await list({}, emptyToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  test.each([{ limit: 0 }, { limit: 51 }, { limit: "abc" }, { cursor: "no-es-un-cursor" }])(
    "responde 400 con query inválida %o",
    async (query) => {
      const res = await list(query);
      expect(res.status).toBe(400);
    }
  );

  test("GET /api/notifications/unread-count sin token responde 401", async () => {
    const res = await request(app).get("/api/notifications/unread-count");
    expect(res.status).toBe(401);
  });

  test("GET /api/notifications/unread-count cuenta solo las no leídas propias", async () => {
    const res = await request(app).get("/api/notifications/unread-count").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // índices 1 y 3 quedaron sin leer
    expect(res.body).toEqual({ count: 2 });

    const empty = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${emptyToken}`);
    expect(empty.body).toEqual({ count: 0 });
  });
});
