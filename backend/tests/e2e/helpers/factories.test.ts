import { prisma } from "../../../src/db/client";
import { createE2EContext } from "./factories";

describe("E2E factories: registerAndLogin", () => {
  const ctx = createE2EContext("factories");

  afterAll(async () => {
    await ctx.cleanup();
    await prisma.$disconnect();
  });

  test("marks the email as verified by default", async () => {
    const user = await ctx.registerAndLogin("verified");

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.emailVerifiedAt).toBeInstanceOf(Date);
  });

  test("leaves the email unverified with { verified: false }", async () => {
    const user = await ctx.registerAndLogin("unverified", { verified: false });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.emailVerifiedAt).toBeNull();
  });
});
