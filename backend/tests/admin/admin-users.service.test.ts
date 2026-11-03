import { Role } from "@prisma/client";
import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as adminUsersService from "../../src/services/admin-users.service";
import { createTestUser } from "../helpers/users";

async function expectAppError(promise: Promise<unknown>, statusCode: number, code?: string): Promise<void> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).statusCode).toBe(statusCode);
  if (code) expect((error as AppError).code).toBe(code);
}

describe("admin-users.service changeRole", () => {
  const userIds: number[] = [];

  async function makeUser(prefix: string, role: Role): Promise<number> {
    const { user } = await createTestUser({ prefix: `admin-svc-${prefix}`, role });
    userIds.push(user.id);
    return user.id;
  }

  afterAll(async () => {
    await prisma.roleChangeAudit.deleteMany({
      where: { OR: [{ actorId: { in: userIds } }, { targetId: { in: userIds } }] },
    });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function countSideEffects(actorId: number, targetId: number) {
    const audits = await prisma.roleChangeAudit.count({ where: { actorId, targetId } });
    const notifications = await prisma.notification.count({ where: { userId: targetId, type: "role_change" } });
    return { audits, notifications };
  }

  it("promotes a regular user, writing the audit entry and the role_change notification", async () => {
    const actorId = await makeUser("actor", "admin");
    const targetId = await makeUser("target", "usuario_regular");

    const result = await adminUsersService.changeRole(actorId, targetId, "moderador");

    expect(result).toMatchObject({ id: targetId, role: "moderador" });
    expect(result).not.toHaveProperty("passwordHash");
    expect((await prisma.user.findUnique({ where: { id: targetId } }))!.role).toBe("moderador");

    const audits = await prisma.roleChangeAudit.findMany({ where: { targetId } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actorId, targetId, previousRole: "usuario_regular", newRole: "moderador" });

    const notifications = await prisma.notification.findMany({ where: { userId: targetId, type: "role_change" } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toBe("Un administrador cambió tu rol a Moderador.");
  });

  it("allows any pair of roles, including demoting another admin", async () => {
    const actorId = await makeUser("actor", "admin");
    const modId = await makeUser("mod", "moderador");
    const otherAdminId = await makeUser("otheradmin", "admin");

    await adminUsersService.changeRole(actorId, modId, "admin");
    const demoted = await adminUsersService.changeRole(actorId, otherAdminId, "usuario_regular");

    expect((await prisma.user.findUnique({ where: { id: modId } }))!.role).toBe("admin");
    expect(demoted.role).toBe("usuario_regular");
    expect(await prisma.roleChangeAudit.count({ where: { actorId } })).toBe(2);
  });

  it("rejects changing the own role for any value with SELF_ROLE_CHANGE", async () => {
    const actorId = await makeUser("self", "admin");

    await expectAppError(adminUsersService.changeRole(actorId, actorId, "moderador"), 400, "SELF_ROLE_CHANGE");
    await expectAppError(adminUsersService.changeRole(actorId, actorId, "admin"), 400, "SELF_ROLE_CHANGE");

    expect((await prisma.user.findUnique({ where: { id: actorId } }))!.role).toBe("admin");
    expect(await countSideEffects(actorId, actorId)).toEqual({ audits: 0, notifications: 0 });
  });

  it("rejects a same-role request with ROLE_UNCHANGED and writes nothing", async () => {
    const actorId = await makeUser("actor", "admin");
    const targetId = await makeUser("target", "moderador");

    await expectAppError(adminUsersService.changeRole(actorId, targetId, "moderador"), 400, "ROLE_UNCHANGED");

    expect(await countSideEffects(actorId, targetId)).toEqual({ audits: 0, notifications: 0 });
  });

  it("returns 404 for a nonexistent target", async () => {
    const actorId = await makeUser("actor", "admin");

    await expectAppError(adminUsersService.changeRole(actorId, 2147483000, "moderador"), 404);

    expect(await prisma.roleChangeAudit.count({ where: { actorId } })).toBe(0);
  });

  it("returns 403 when the actor is no longer an admin", async () => {
    const actorId = await makeUser("demoted", "moderador");
    const targetId = await makeUser("target", "usuario_regular");

    await expectAppError(adminUsersService.changeRole(actorId, targetId, "moderador"), 403);

    expect((await prisma.user.findUnique({ where: { id: targetId } }))!.role).toBe("usuario_regular");
    expect(await countSideEffects(actorId, targetId)).toEqual({ audits: 0, notifications: 0 });
  });

  it("delivers the notification even when the target disabled every preference", async () => {
    const actorId = await makeUser("actor", "admin");
    const targetId = await makeUser("target", "usuario_regular");
    await prisma.notificationPreference.create({
      data: {
        userId: targetId,
        notifyMatch: false,
        notifyMessage: false,
        notifyStatusChange: false,
        notifyNearby: false,
      },
    });

    await adminUsersService.changeRole(actorId, targetId, "moderador");

    expect((await countSideEffects(actorId, targetId)).notifications).toBe(1);
  });

  it("rolls back role and audit when the notification insert fails", async () => {
    const actorId = await makeUser("actor", "admin");
    const targetId = await makeUser("target", "usuario_regular");
    const original = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, "$transaction").mockImplementationOnce(((fn: (tx: unknown) => Promise<unknown>) =>
      original((tx) =>
        fn(
          new Proxy(tx, {
            get: (target, prop, receiver) =>
              prop === "notification"
                ? { create: () => Promise.reject(new Error("boom")) }
                : Reflect.get(target, prop, receiver),
          }),
        ),
      )) as never);

    await expect(adminUsersService.changeRole(actorId, targetId, "moderador")).rejects.toThrow("boom");

    expect((await prisma.user.findUnique({ where: { id: targetId } }))!.role).toBe("usuario_regular");
    expect(await countSideEffects(actorId, targetId)).toEqual({ audits: 0, notifications: 0 });
  });

  it("lets exactly one of two concurrent mutual demotions succeed", async () => {
    const adminA = await makeUser("raceA", "admin");
    const adminB = await makeUser("raceB", "admin");

    const results = await Promise.allSettled([
      adminUsersService.changeRole(adminA, adminB, "usuario_regular"),
      adminUsersService.changeRole(adminB, adminA, "usuario_regular"),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(AppError);
    expect((rejected.reason as AppError).statusCode).toBe(403);
    const roles = await prisma.user.findMany({ where: { id: { in: [adminA, adminB] } }, select: { role: true } });
    expect(roles.filter((u) => u.role === "admin")).toHaveLength(1);
    expect(await prisma.roleChangeAudit.count({ where: { actorId: { in: [adminA, adminB] } } })).toBe(1);
  });
});

describe("admin-users.service assertAdminRemains", () => {
  it("throws LAST_ADMIN (409) when demoting the only admin", () => {
    let thrown: unknown;
    try {
      adminUsersService.assertAdminRemains(1, "admin", "moderador");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(AppError);
    expect(thrown).toMatchObject({ statusCode: 409, code: "LAST_ADMIN" });
  });

  it("allows demoting an admin when another remains", () => {
    expect(() => adminUsersService.assertAdminRemains(2, "admin", "usuario_regular")).not.toThrow();
  });

  it("ignores changes that do not remove an admin", () => {
    expect(() => adminUsersService.assertAdminRemains(1, "moderador", "usuario_regular")).not.toThrow();
    expect(() => adminUsersService.assertAdminRemains(1, "moderador", "admin")).not.toThrow();
  });
});
