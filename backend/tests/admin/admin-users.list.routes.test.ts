import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";

describe("GET /api/admin/users and /api/admin/role-audit", () => {
  const userIds: number[] = [];
  const tag = `zq${Date.now().toString(36)}`;

  async function makeUser(prefix: string, role: Role, fullName?: string) {
    const created = await createTestUser({ prefix: `admin-list-${prefix}`, role });
    if (fullName !== undefined) {
      await prisma.user.update({ where: { id: created.user.id }, data: { fullName } });
    }
    userIds.push(created.user.id);
    return created;
  }

  const get = (path: string, token: string | null) => {
    const req = request(app).get(path);
    if (token) req.set("Authorization", `Bearer ${token}`);
    return req;
  };

  let admin: Awaited<ReturnType<typeof makeUser>>;
  let maria: Awaited<ReturnType<typeof makeUser>>;
  let noName: Awaited<ReturnType<typeof makeUser>>;
  let mod: Awaited<ReturnType<typeof makeUser>>;

  beforeAll(async () => {
    admin = await makeUser("admin", "admin");
    maria = await makeUser("maria", "usuario_regular", `Maria ${tag}`);
    noName = await makeUser(`nn${tag}`, "usuario_regular");
    mod = await makeUser("mod", "moderador", `Mod ${tag}`);
  });

  afterAll(async () => {
    await prisma.roleChangeAudit.deleteMany({
      where: { OR: [{ actorId: { in: userIds } }, { targetId: { in: userIds } }] },
    });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  describe("GET /api/admin/users", () => {
    it("matches fullName case-insensitively and never exposes secrets", async () => {
      const res = await get(`/api/admin/users?q=MARIA ${tag.toUpperCase()}`, admin.token);

      expect(res.status).toBe(200);
      expect(res.body.items.map((u: { id: number }) => u.id)).toEqual([maria.user.id]);
      expect(res.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(Object.keys(res.body.items[0]).sort()).toEqual(["createdAt", "email", "fullName", "id", "role"]);
    });

    it("finds a user with null fullName by email fragment", async () => {
      const res = await get(`/api/admin/users?q=nn${tag}`, admin.token);

      expect(res.body.items.map((u: { id: number }) => u.id)).toEqual([noName.user.id]);
      expect(res.body.items[0].fullName).toBeNull();
    });

    it("filters by role and combines it with q (AND)", async () => {
      const byRole = await get(`/api/admin/users?role=moderador&q=${tag}`, admin.token);
      const none = await get(`/api/admin/users?role=admin&q=${tag}`, admin.token);

      expect(byRole.body.items.map((u: { id: number }) => u.id)).toEqual([mod.user.id]);
      expect(none.status).toBe(200);
      expect(none.body).toMatchObject({ items: [], total: 0 });
    });

    it("paginates with page and pageSize", async () => {
      const res = await get(`/api/admin/users?q=${tag}&pageSize=1&page=2`, admin.token);

      expect(res.body.items).toHaveLength(1);
      expect(res.body).toMatchObject({ total: 3, page: 2, pageSize: 1 });
    });

    it.each(["role=superadmin", "page=0", "page=abc", "pageSize=0", "pageSize=51"])("returns 400 for %s", async (qs) => {
      const res = await get(`/api/admin/users?${qs}`, admin.token);

      expect(res.status).toBe(400);
    });

    it("returns 401 without token and 403 for non-admins", async () => {
      expect((await get("/api/admin/users", null)).status).toBe(401);
      expect((await get("/api/admin/users", mod.token)).status).toBe(403);
      expect((await get("/api/admin/users", maria.token)).status).toBe(403);
    });
  });

  describe("GET /api/admin/role-audit", () => {
    const base = new Date("2099-01-01T00:00:00Z");
    let ids: number[];

    beforeAll(async () => {
      const mk = (offsetMs: number, previousRole: Role, newRole: Role) =>
        prisma.roleChangeAudit.create({
          data: {
            actorId: admin.user.id,
            targetId: maria.user.id,
            previousRole,
            newRole,
            createdAt: new Date(base.getTime() + offsetMs),
          },
        });
      const oldest = await mk(0, "usuario_regular", "moderador");
      const tieA = await mk(1000, "moderador", "admin");
      const tieB = await mk(1000, "admin", "moderador");
      ids = [oldest.id, tieA.id, tieB.id];
    });

    it("lists newest first with id desc tiebreak and identities", async () => {
      const res = await get("/api/admin/role-audit?pageSize=3", admin.token);

      expect(res.status).toBe(200);
      expect(res.body.items.map((e: { id: number }) => e.id)).toEqual([ids[2], ids[1], ids[0]]);
      expect(res.body.items[0]).toMatchObject({
        previousRole: "admin",
        newRole: "moderador",
        actor: { id: admin.user.id, email: admin.user.email },
        target: { id: maria.user.id, email: maria.user.email, fullName: `Maria ${tag}` },
      });
      expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    });

    it("paginates and keeps historical entries unchanged after later changes", async () => {
      const before = await prisma.roleChangeAudit.findUnique({ where: { id: ids[0] } });
      await request(app)
        .patch(`/api/admin/users/${noName.user.id}/role`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ role: "moderador" });

      const page = await get("/api/admin/role-audit?pageSize=1&page=2", admin.token);

      expect(page.body.items).toHaveLength(1);
      expect(page.body).toMatchObject({ page: 2, pageSize: 1 });
      expect(page.body.total).toBeGreaterThanOrEqual(4);
      expect(await prisma.roleChangeAudit.findUnique({ where: { id: ids[0] } })).toEqual(before);
    });

    it("returns an empty list for a page beyond the end", async () => {
      const res = await get("/api/admin/role-audit?page=100000", admin.token);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });

    it.each(["page=0", "pageSize=51", "pageSize=abc"])("returns 400 for %s", async (qs) => {
      expect((await get(`/api/admin/role-audit?${qs}`, admin.token)).status).toBe(400);
    });

    it("ignores filter params (only pagination applies)", async () => {
      const res = await get(`/api/admin/role-audit?pageSize=3&role=admin&actorId=999999`, admin.token);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(3);
    });

    it("returns 401 without token and 403 for non-admins", async () => {
      expect((await get("/api/admin/role-audit", null)).status).toBe(401);
      expect((await get("/api/admin/role-audit", mod.token)).status).toBe(403);
      expect((await get("/api/admin/role-audit", maria.token)).status).toBe(403);
    });

    it.each(["put", "patch", "delete"] as const)("answers 404 to %s on the audit log for an admin", async (method) => {
      const res = await request(app)
        [method](`/api/admin/role-audit/${ids[0]}`)
        .set("Authorization", `Bearer ${admin.token}`);
      const root = await request(app)
        [method]("/api/admin/role-audit")
        .set("Authorization", `Bearer ${admin.token}`);

      expect(res.status).toBe(404);
      expect(root.status).toBe(404);
      expect(await prisma.roleChangeAudit.count({ where: { id: ids[0] } })).toBe(1);
    });
  });
});
