import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../../src/db/client";

const MIGRATION_SQL = readFileSync(
  join(__dirname, "../../prisma/migrations/20261012000000_backfill_email_verified_at/migration.sql"),
  "utf8"
);

/** Aborta la transacción a propósito para que el UPDATE nunca quede aplicado. */
class Rollback extends Error {}

describe("migración 20261012000000_backfill_email_verified_at", () => {
  const createdUserIds: number[] = [];

  async function createUser(data: { createdAt: Date; emailVerifiedAt: Date | null }) {
    const user = await prisma.user.create({
      data: {
        email: `backfill-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        passwordHash: "test-hash",
        ...data,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  test("marca como verificados a los usuarios existentes con su created_at y respeta los ya verificados", async () => {
    const signedUpAt = new Date("2026-01-15T10:00:00.000Z");
    const verifiedAt = new Date("2026-02-01T12:30:00.000Z");
    const unverified = await createUser({ createdAt: signedUpAt, emailVerifiedAt: null });
    const alreadyVerified = await createUser({ createdAt: signedUpAt, emailVerifiedAt: verifiedAt });

    let inside: { unverified: Date | null; alreadyVerified: Date | null } | undefined;
    try {
      // Dentro de una transacción que se deshace: no deja efectos para las suites que corren en paralelo.
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(MIGRATION_SQL);
        const rows = await tx.user.findMany({
          where: { id: { in: [unverified.id, alreadyVerified.id] } },
          select: { id: true, emailVerifiedAt: true },
        });
        const byId = new Map(rows.map((row) => [row.id, row.emailVerifiedAt]));
        inside = { unverified: byId.get(unverified.id) ?? null, alreadyVerified: byId.get(alreadyVerified.id) ?? null };
        throw new Rollback();
      });
    } catch (error) {
      if (!(error instanceof Rollback)) {
        throw error;
      }
    }

    expect(inside?.unverified).toEqual(signedUpAt);
    expect(inside?.alreadyVerified).toEqual(verifiedAt);

    // El rollback dejó todo como estaba: los usuarios nuevos siguen naciendo sin verificar.
    const after = await prisma.user.findUniqueOrThrow({ where: { id: unverified.id } });
    expect(after.emailVerifiedAt).toBeNull();
  });
});
