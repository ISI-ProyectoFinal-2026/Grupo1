import { prisma } from "../../src/db/client";
import * as chatsService from "../../src/services/chats.service";
import * as matchingService from "../../src/services/matching.service";
import * as notificationsService from "../../src/services/notifications.service";
import * as inactivityService from "../../src/services/report-inactivity.service";

describe("solo el dueño reinicia la inactividad (#264)", () => {
  let touchSpy: jest.SpyInstance;

  beforeEach(() => {
    touchSpy = jest.spyOn(inactivityService, "touchActivity").mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe("createMessage", () => {
    beforeEach(() => {
      jest.spyOn(prisma.message, "create").mockResolvedValue({ id: 1 } as never);
    });

    test("mensaje del dueño del reporte reinicia el contador", async () => {
      const findSpy = jest
        .spyOn(prisma.chat, "findUnique")
        .mockResolvedValue({ reportId: 9, report: { userId: 5 } } as never);

      await chatsService.createMessage(1, 5, { content: "hola" });

      expect(touchSpy).toHaveBeenCalledWith([9]);
      expect(findSpy).toHaveBeenCalledTimes(1);
    });

    test("mensaje de la otra parte no reinicia el contador", async () => {
      jest.spyOn(prisma.chat, "findUnique").mockResolvedValue({ reportId: 9, report: { userId: 5 } } as never);

      await chatsService.createMessage(1, 6, { content: "hola" });

      expect(touchSpy).not.toHaveBeenCalled();
    });

    test("chat sin reporte no reinicia nada", async () => {
      jest.spyOn(prisma.chat, "findUnique").mockResolvedValue({ reportId: null, report: null } as never);

      await chatsService.createMessage(1, 5, { content: "hola" });

      expect(touchSpy).not.toHaveBeenCalled();
    });
  });

  describe("confirmMatch", () => {
    beforeEach(() => {
      jest.spyOn(prisma.report, "findUnique").mockResolvedValue({ userId: 5 } as never);
      jest.spyOn(prisma.reportMatch, "findUnique").mockResolvedValue({ reportLostId: 10, reportFoundId: 20 } as never);
      jest.spyOn(prisma.reportMatch, "updateMany").mockResolvedValue({ count: 1 } as never);
      jest.spyOn(notificationsService, "notifyMatchConfirmed").mockResolvedValue(null);
    });

    test("reinicia solo el reporte de quien confirma", async () => {
      await matchingService.confirmMatch(20, 1, 5);

      expect(touchSpy).toHaveBeenCalledTimes(1);
      expect(touchSpy).toHaveBeenCalledWith([20]);
    });

    test("rechazar no cuenta como actividad", async () => {
      await matchingService.rejectMatch(20, 1, 5);

      expect(touchSpy).not.toHaveBeenCalled();
    });
  });
});
