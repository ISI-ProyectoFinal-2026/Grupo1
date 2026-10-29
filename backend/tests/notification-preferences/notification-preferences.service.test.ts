import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as service from "../../src/services/notification-preferences.service";
import { createTestUser } from "../helpers/users";

describe("notification-preferences.service", () => {
  let userId: number;

  beforeAll(async () => {
    userId = (await createTestUser({ prefix: "notif-prefs-svc" })).user.id;
  });

  afterAll(async () => {
    await prisma.notificationPreference.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("get devuelve defaults sin crear fila", async () => {
    const prefs = await service.get(userId);
    expect(prefs.notifyNearby).toBe(true);
    expect(prefs.location).toBeNull();
    expect(await prisma.notificationPreference.count({ where: { userId } })).toBe(0);
  });

  it("update con notifyNearby=true sin consentimiento lanza AppError 409", async () => {
    await expect(service.update(userId, { notifyNearby: true })).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.update(userId, { notifyNearby: true })).rejects.toBeInstanceOf(AppError);
    expect(await prisma.notificationPreference.count({ where: { userId } })).toBe(0);
  });

  it("setLocation sin consentimiento lanza AppError 403", async () => {
    await expect(service.setLocation(userId, { latitude: 0, longitude: 0 })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("flujo accepted -> location -> declined", async () => {
    await service.setLocationConsent(userId, "accepted");
    await service.update(userId, { notifyNearby: true });
    const withLoc = await service.setLocation(userId, { latitude: 10.5, longitude: -20.25 });
    expect(withLoc.location?.latitude).toBeCloseTo(10.5, 6);
    expect(withLoc.location?.longitude).toBeCloseTo(-20.25, 6);

    const declined = await service.setLocationConsent(userId, "declined");
    expect(declined.location).toBeNull();
    expect(declined.notifyNearby).toBe(false);
  });
});
