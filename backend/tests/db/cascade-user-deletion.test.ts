import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";

// Baja definitiva de cuentas (#38): un solo prisma.user.delete() tiene que
// arrastrar todo lo que cuelga del usuario, y las auditorías de staff tienen
// que conservar el historial dejando el actor en null.
describe("migración 20261110000000_cascade_user_deletion", () => {
  const userIds: number[] = [];

  async function newUser(prefix: string) {
    const { user } = await createTestUser({ prefix });
    userIds.push(user.id);
    return user;
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  test("ninguna FK queda en RESTRICT/NO ACTION y las de actor de auditoría quedan en SET NULL", async () => {
    const fks = await prisma.$queryRaw<{ table: string; column: string; rule: string }[]>`
      SELECT c.conrelid::regclass::text AS table, a.attname AS column, c.confdeltype::text AS rule
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f'`;

    expect(fks.filter((fk) => fk.rule === "r" || fk.rule === "a")).toEqual([]);
    const rule = (table: string, column: string) => fks.find((fk) => fk.table === table && fk.column === column)?.rule;
    expect(rule("role_change_audits", "actor_id")).toBe("n");
    expect(rule("account_sanction_events", "actor_id")).toBe("n");
    expect(rule("role_change_audits", "target_id")).toBe("c");
  });

  test("eliminar la cuenta borra su grafo completo y deja intactos a los demás", async () => {
    const target = await newUser("cascade-target");
    const other = await newUser("cascade-other");
    const staff = await newUser("cascade-staff");

    const pet = await prisma.pet.create({ data: { userId: target.id, name: "Firulais", photoUrls: [] } });
    const report = await prisma.report.create({
      data: { userId: target.id, petId: pet.id, reportType: "lost", title: "Perdido" },
    });
    const otherReport = await prisma.report.create({ data: { userId: other.id, reportType: "found", title: "Encontrado" } });
    const chat = await prisma.chat.create({ data: { userAId: target.id, userBId: other.id, reportId: report.id } });
    await prisma.message.createMany({
      data: [
        { chatId: chat.id, senderId: target.id, content: "hola" },
        { chatId: chat.id, senderId: other.id, content: "hola!" },
      ],
    });
    await prisma.notification.create({ data: { userId: target.id, reportId: otherReport.id } });
    const otherNotification = await prisma.notification.create({ data: { userId: other.id, reportId: report.id } });
    await prisma.reportFlag.create({ data: { reportId: otherReport.id, userId: target.id, reason: "spam" } });
    const business = await prisma.business.create({
      data: {
        userId: target.id,
        name: "Veterinaria",
        cuit: `20-${Date.now().toString().slice(-8)}-1`,
        address: "Calle 1",
        phone: "123",
        category: "VETERINARIA",
      },
    });
    await prisma.accountReport.create({ data: { reporterId: target.id, reportedUserId: other.id, severity: "mild" } });
    const sanction = await prisma.accountSanction.create({
      data: {
        userId: target.id,
        severity: "severe",
        kind: "provisional",
        status: "active",
        reason: "x",
        triggeringReportIds: [],
        startsAt: new Date(),
      },
    });
    await prisma.accountReport.create({
      data: { reporterId: other.id, reportedUserId: target.id, severity: "severe", sanctionId: sanction.id },
    });
    await prisma.accountSanctionEvent.create({ data: { sanctionId: sanction.id, actorId: null, type: "created" } });
    await prisma.roleChangeAudit.create({
      data: { actorId: staff.id, targetId: target.id, previousRole: "usuario_regular", newRole: "moderador" },
    });
    const staffSanction = await prisma.accountSanction.create({
      data: {
        userId: other.id,
        severity: "mild",
        kind: "temporary",
        status: "expired",
        reason: "x",
        triggeringReportIds: [],
        startsAt: new Date(),
      },
    });
    const keptEvent = await prisma.accountSanctionEvent.create({
      data: { sanctionId: staffSanction.id, actorId: target.id, type: "confirmed", reason: "ok" },
    });
    const keptAudit = await prisma.roleChangeAudit.create({
      data: { actorId: target.id, targetId: other.id, previousRole: "usuario_regular", newRole: "moderador" },
    });

    await prisma.user.delete({ where: { id: target.id } });

    expect(await prisma.pet.count({ where: { id: pet.id } })).toBe(0);
    expect(await prisma.report.count({ where: { id: report.id } })).toBe(0);
    expect(await prisma.chat.count({ where: { id: chat.id } })).toBe(0);
    expect(await prisma.message.count({ where: { chatId: chat.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: target.id } })).toBe(0);
    expect(await prisma.reportFlag.count({ where: { userId: target.id } })).toBe(0);
    expect(await prisma.business.count({ where: { id: business.id } })).toBe(0);
    expect(await prisma.accountReport.count({ where: { OR: [{ reporterId: target.id }, { reportedUserId: target.id }] } })).toBe(0);
    expect(await prisma.accountSanction.count({ where: { id: sanction.id } })).toBe(0);
    expect(await prisma.accountSanctionEvent.count({ where: { sanctionId: sanction.id } })).toBe(0);
    expect(await prisma.roleChangeAudit.count({ where: { targetId: target.id } })).toBe(0);

    // lo de los demás queda, con el actor eliminado en null
    expect(await prisma.report.count({ where: { id: otherReport.id } })).toBe(1);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: otherNotification.id } })).reportId).toBeNull();
    expect((await prisma.accountSanctionEvent.findUniqueOrThrow({ where: { id: keptEvent.id } })).actorId).toBeNull();
    expect((await prisma.roleChangeAudit.findUniqueOrThrow({ where: { id: keptAudit.id } })).actorId).toBeNull();
  });
});
