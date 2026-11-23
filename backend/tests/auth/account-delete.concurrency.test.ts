import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as mailService from "../../src/services/mail.service";
import { codeFor, seedTwoFactor } from "../helpers/two-factor";
import { createTestUser } from "../helpers/users";

const PASSWORD = "Password123";

// espera a que alguna sesión quede esperando un advisory lock
async function waitForAdvisoryWaiter(): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const [{ waiting }] = await prisma.$queryRaw<Array<{ waiting: number }>>`
      SELECT count(*)::int AS waiting FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`;
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("La baja nunca quedó esperando el lock de role_change");
}

// baja con 2FA contra un cambio de rol concurrente (#366)
describe("DELETE /api/auth/me con 2FA y cambio de rol en curso", () => {
  const userIds: number[] = [];

  beforeEach(() => {
    jest.spyOn(mailService, "sendAccountDeleted").mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  test("respeta el orden de locks de changeRole y no termina en deadlock", async () => {
    const { user, token } = await createTestUser({ prefix: "delete-2fa-lock", password: PASSWORD });
    userIds.push(user.id);
    const { secret } = await seedTwoFactor(user.id);

    let deletion: Promise<request.Response> | undefined;
    // mismo orden que changeRole: advisory lock y después la fila del usuario
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('role_change'))`;
        deletion = request(app)
          .delete("/api/auth/me")
          .set({ Authorization: `Bearer ${token}` })
          .send({ password: PASSWORD, code: codeFor(secret) })
          .then((res) => res);
        await waitForAdvisoryWaiter();
        await tx.user.update({ where: { id: user.id }, data: { role: "moderador" } });
      },
      { timeout: 15_000 }
    );

    const res = await deletion!;
    expect(res.status).toBe(204);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0);
  }, 20_000);
});
