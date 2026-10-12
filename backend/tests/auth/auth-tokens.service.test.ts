import { prisma } from "../../src/db/client";
import { issueAuthToken, latestAuthTokenCreatedAt } from "../../src/services/auth-tokens.service";

describe("auth-tokens.service — latestAuthTokenCreatedAt()", () => {
  let userId: number;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `auth-tokens-latest-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test("sin tokens devuelve null", async () => {
    await expect(latestAuthTokenCreatedAt(userId, "email_verification")).resolves.toBeNull();
  });

  test("devuelve el created_at del último token del tipo, aunque ya esté invalidado o usado", async () => {
    await issueAuthToken(userId, "email_verification");
    const first = await prisma.authToken.findFirstOrThrow({ where: { userId, type: "email_verification" } });
    await prisma.authToken.update({
      where: { id: first.id },
      data: { createdAt: new Date(Date.now() - 3_600_000), usedAt: new Date() },
    });
    await issueAuthToken(userId, "email_verification");
    const latest = await prisma.authToken.findFirstOrThrow({
      where: { userId, type: "email_verification" },
      orderBy: { id: "desc" },
    });
    await prisma.authToken.update({ where: { id: latest.id }, data: { usedAt: new Date() } });

    await expect(latestAuthTokenCreatedAt(userId, "email_verification")).resolves.toEqual(latest.createdAt);
  });

  test("no mezcla tipos: un token de reset no cuenta para la verificación", async () => {
    const other = await prisma.user.create({
      data: { email: `auth-tokens-latest-other-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    try {
      await issueAuthToken(other.id, "password_reset");

      await expect(latestAuthTokenCreatedAt(other.id, "email_verification")).resolves.toBeNull();
      await expect(latestAuthTokenCreatedAt(other.id, "password_reset")).resolves.toEqual(expect.any(Date));
    } finally {
      await prisma.user.delete({ where: { id: other.id } });
    }
  });
});
