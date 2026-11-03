import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";

describe("PATCH /api/admin/users/:id/role", () => {
  const userIds: number[] = [];

  async function makeUser(prefix: string, role: Role) {
    const created = await createTestUser({ prefix: `admin-routes-${prefix}`, role });
    userIds.push(created.user.id);
    return created;
  }

  const patchRole = (id: number | string, token: string | null, body: unknown) => {
    const req = request(app).patch(`/api/admin/users/${id}/role`);
    if (token) req.set("Authorization", `Bearer ${token}`);
    return req.send(body as object);
  };

  afterAll(async () => {
    await prisma.roleChangeAudit.deleteMany({
      where: { OR: [{ actorId: { in: userIds } }, { targetId: { in: userIds } }] },
    });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("returns 401 without a token and changes nothing", async () => {
    const target = await makeUser("t401", "usuario_regular");

    const res = await patchRole(target.user.id, null, { role: "moderador" });

    expect(res.status).toBe(401);
    expect((await prisma.user.findUnique({ where: { id: target.user.id } }))!.role).toBe("usuario_regular");
  });

  it.each<Role>(["usuario_regular", "moderador"])("returns 403 for a %s caller and changes nothing", async (role) => {
    const caller = await makeUser(`c403-${role}`, role);
    const target = await makeUser(`t403-${role}`, "usuario_regular");

    const res = await patchRole(target.user.id, caller.token, { role: "moderador" });

    expect(res.status).toBe(403);
    expect((await prisma.user.findUnique({ where: { id: target.user.id } }))!.role).toBe("usuario_regular");
    expect(await prisma.roleChangeAudit.count({ where: { targetId: target.user.id } })).toBe(0);
  });

  it("returns 200 with the updated user for an admin", async () => {
    const admin = await makeUser("a200", "admin");
    const target = await makeUser("t200", "usuario_regular");

    const res = await patchRole(target.user.id, admin.token, { role: "moderador" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: target.user.id, email: target.user.email, role: "moderador" });
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("applies the new role to the very next request without re-login", async () => {
    const admin = await makeUser("a-imm", "admin");
    const target = await makeUser("t-imm", "usuario_regular");
    const other = await makeUser("o-imm", "usuario_regular");

    expect((await patchRole(other.user.id, target.token, { role: "moderador" })).status).toBe(403);
    await patchRole(target.user.id, admin.token, { role: "admin" });
    const promoted = await patchRole(other.user.id, target.token, { role: "moderador" });

    expect(promoted.status).toBe(200);
  });

  it("returns 403 to a demoted admin holding an older token", async () => {
    const admin = await makeUser("a-dem", "admin");
    const demoter = await makeUser("d-dem", "admin");
    const target = await makeUser("t-dem", "usuario_regular");

    expect((await patchRole(admin.user.id, demoter.token, { role: "usuario_regular" })).status).toBe(200);
    const res = await patchRole(target.user.id, admin.token, { role: "moderador" });

    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid role, a missing body and a bad id", async () => {
    const admin = await makeUser("a400", "admin");
    const target = await makeUser("t400", "usuario_regular");

    expect((await patchRole(target.user.id, admin.token, { role: "superadmin" })).status).toBe(400);
    expect((await patchRole(target.user.id, admin.token, {})).status).toBe(400);
    expect((await patchRole("abc", admin.token, { role: "moderador" })).status).toBe(400);
  });

  it("returns 404 for a nonexistent target", async () => {
    const admin = await makeUser("a404", "admin");

    const res = await patchRole(2147483000, admin.token, { role: "moderador" });

    expect(res.status).toBe(404);
  });

  it("returns 400 SELF_ROLE_CHANGE and 400 ROLE_UNCHANGED with stable codes", async () => {
    const admin = await makeUser("a-codes", "admin");
    const target = await makeUser("t-codes", "moderador");

    const self = await patchRole(admin.user.id, admin.token, { role: "moderador" });
    const same = await patchRole(target.user.id, admin.token, { role: "moderador" });

    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe("SELF_ROLE_CHANGE");
    expect(same.status).toBe(400);
    expect(same.body.error.code).toBe("ROLE_UNCHANGED");
  });

  it("keeps moderator-only routes working for moderators (regression)", async () => {
    const moderator = await makeUser("mod-reg", "moderador");

    const res = await request(app).get("/api/report-flags").set("Authorization", `Bearer ${moderator.token}`);

    expect(res.status).toBe(200);
  });
});
