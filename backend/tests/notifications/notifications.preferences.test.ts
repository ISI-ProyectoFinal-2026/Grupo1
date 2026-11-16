import { prisma } from "../../src/db/client";
import * as prefsService from "../../src/services/notification-preferences.service";
import { createForMatch, createForStatusChange, notifyNewMessage } from "../../src/services/notifications.service";
import { createTestUser } from "../helpers/users";

describe("notificaciones respetan las preferencias (#33)", () => {
  let ownerA: number;
  let ownerB: number;
  let reportA: number;
  let reportB: number;
  let chatId: number;

  const setPrefs = (userId: number, data: Record<string, boolean>) =>
    prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...data }, update: data });

  beforeAll(async () => {
    ownerA = (await createTestUser({ prefix: "notif-prefs-a" })).user.id;
    ownerB = (await createTestUser({ prefix: "notif-prefs-b" })).user.id;
    reportA = (await prisma.report.create({ data: { userId: ownerA, reportType: "lost", status: "published", title: "Perdido A" } })).id;
    reportB = (await prisma.report.create({ data: { userId: ownerB, reportType: "found", status: "published", title: "Encontrado B" } })).id;
    const [userAId, userBId] = ownerA < ownerB ? [ownerA, ownerB] : [ownerB, ownerA];
    chatId = (await prisma.chat.create({ data: { userAId, userBId, reportId: reportA } })).id;
  });

  afterEach(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: [ownerA, ownerB] } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: [ownerA, ownerB] } } });
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { chatId } });
    await prisma.chat.delete({ where: { id: chatId } });
    await prisma.report.deleteMany({ where: { id: { in: [reportA, reportB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerA, ownerB] } } });
    await prisma.$disconnect();
  });

  describe("isNotificationEnabled", () => {
    it("sin fila devuelve true", async () => {
      await expect(prefsService.isNotificationEnabled(ownerA, "notifyMatch")).resolves.toBe(true);
    });

    it("refleja el valor guardado", async () => {
      await setPrefs(ownerA, { notifyMessage: false });
      await expect(prefsService.isNotificationEnabled(ownerA, "notifyMessage")).resolves.toBe(false);
      await expect(prefsService.isNotificationEnabled(ownerA, "notifyMatch")).resolves.toBe(true);
    });
  });

  describe("createForMatch", () => {
    const input = () => ({
      lostReportId: reportA,
      foundReportId: reportB,
      lostOwnerId: ownerA,
      foundOwnerId: ownerB,
      similarityScore: 0.9,
    });

    it("sin preferencias notifica a ambos", async () => {
      const result = await createForMatch(input());
      expect(result.map((n) => n.userId).sort()).toEqual([ownerA, ownerB].sort());
    });

    it("el dueño con notifyMatch=false no recibe y el otro sí", async () => {
      await setPrefs(ownerA, { notifyMatch: false });
      const result = await createForMatch(input());
      expect(result.map((n) => n.userId)).toEqual([ownerB]);
      await expect(prisma.notification.count({ where: { userId: ownerA } })).resolves.toBe(0);
    });

    it("ambos desactivados devuelve []", async () => {
      await setPrefs(ownerA, { notifyMatch: false });
      await setPrefs(ownerB, { notifyMatch: false });
      await expect(createForMatch(input())).resolves.toEqual([]);
      await expect(prisma.notification.count({ where: { userId: { in: [ownerA, ownerB] } } })).resolves.toBe(0);
    });
  });

  describe("createForStatusChange", () => {
    it("notifyStatusChange=false devuelve null sin crear", async () => {
      await setPrefs(ownerA, { notifyStatusChange: false });
      await expect(createForStatusChange(reportA, "published")).resolves.toBeNull();
      await expect(prisma.notification.count({ where: { userId: ownerA } })).resolves.toBe(0);
    });

    it("sin fila crea la notificación", async () => {
      const n = await createForStatusChange(reportA, "published");
      expect(n).toMatchObject({ userId: ownerA, type: "report_status_change" });
    });

    it("con el flag activado crea la notificación", async () => {
      await setPrefs(ownerA, { notifyStatusChange: true });
      await expect(createForStatusChange(reportA, "rejected")).resolves.not.toBeNull();
    });

    it.each(["auto_hidden", "hidden_by_flag", "restored", "hide_confirmed"] as const)(
      "%s se envía aunque notifyStatusChange sea false (#218)",
      async (status) => {
        await setPrefs(ownerA, { notifyStatusChange: false });
        const n = await createForStatusChange(reportA, status);
        expect(n).toMatchObject({ userId: ownerA, type: "report_status_change", reportId: reportA });
      }
    );

    it.each([
      ["auto_hidden", "Tu reporte fue ocultado", "varias denuncias"],
      ["hidden_by_flag", "Tu reporte fue ocultado", "revisa"],
      ["restored", "Tu reporte volvió a estar visible", "visible"],
      ["hide_confirmed", "La moderación confirmó el ocultamiento", "confirm"],
    ] as const)("%s usa su propio texto", async (status, title, fragment) => {
      const n = await createForStatusChange(reportA, status);
      expect(n?.title).toBe(title);
      expect(n?.message).toContain("Perdido A");
      expect(n?.message).toContain(fragment);
    });
  });

  describe("notifyNewMessage", () => {
    const sendMessage = async () => {
      const chat = await prisma.chat.findUniqueOrThrow({ where: { id: chatId } });
      const message = await prisma.message.create({ data: { chatId, senderId: ownerA, content: "Hola" } });
      return { chat, message };
    };

    it("notifyMessage=false del receptor devuelve null sin crear; el mensaje existe", async () => {
      await setPrefs(ownerB, { notifyMessage: false });
      const { chat, message } = await sendMessage();
      await expect(notifyNewMessage(chat, message)).resolves.toBeNull();
      await expect(prisma.notification.count({ where: { userId: ownerB } })).resolves.toBe(0);
      await expect(prisma.message.findUnique({ where: { id: message.id } })).resolves.not.toBeNull();
    });

    it("sin fila crea la notificación para el receptor", async () => {
      const { chat, message } = await sendMessage();
      const n = await notifyNewMessage(chat, message);
      expect(n).toMatchObject({ userId: ownerB, type: "message" });
    });

    it("con el flag activado crea la notificación", async () => {
      await setPrefs(ownerB, { notifyMessage: true });
      const { chat, message } = await sendMessage();
      await expect(notifyNewMessage(chat, message)).resolves.not.toBeNull();
    });
  });
});
