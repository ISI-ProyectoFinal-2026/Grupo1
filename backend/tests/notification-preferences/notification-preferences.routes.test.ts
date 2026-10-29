import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";

const BASE = "/api/notification-preferences";
const CONSENT_MSG = "Activá la ubicación para recibir avisos de tu zona";

describe("/api/notification-preferences", () => {
  let userId: number;
  let token: string;
  let otherUserId: number;
  let otherToken: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const a = await createTestUser({ prefix: "notif-prefs-a" });
    userId = a.user.id;
    token = a.token;
    const b = await createTestUser({ prefix: "notif-prefs-b" });
    otherUserId = b.user.id;
    otherToken = b.token;
  });

  afterAll(async () => {
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await prisma.$disconnect();
  });

  it.each([
    ["get", "/"],
    ["put", "/"],
    ["put", "/location-consent"],
    ["put", "/location"],
  ] as const)("%s %s responde 401 sin token", async (method, path) => {
    const res = await request(app)[method](`${BASE}${path}`).send({});
    expect(res.status).toBe(401);
  });

  it("GET devuelve defaults sin crear fila", async () => {
    const res = await request(app).get(BASE).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      notifyMatch: true,
      notifyMessage: true,
      notifyStatusChange: true,
      notifyNearby: true,
      nearbyRadiusKm: 5,
      nearbyReportType: "both",
      locationConsentStatus: null,
      locationConsentAt: null,
      location: null,
    });
    expect(await prisma.notificationPreference.count({ where: { userId } })).toBe(0);
  });

  it("PUT / sin campos responde 400", async () => {
    const res = await request(app).put(BASE).set(auth(token)).send({});
    expect(res.status).toBe(400);
  });

  it("PUT / parcial actualiza solo lo enviado", async () => {
    const res = await request(app)
      .put(BASE)
      .set(auth(token))
      .send({ notifyMatch: false, notifyNearby: false, nearbyRadiusKm: 10, nearbyReportType: "lost" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      notifyMatch: false,
      notifyMessage: true,
      notifyNearby: false,
      nearbyRadiusKm: 10,
      nearbyReportType: "lost",
    });
    const get = await request(app).get(BASE).set(auth(token));
    expect(get.body).toEqual(res.body);
  });

  it("PUT / con radio inválido responde 400", async () => {
    const res = await request(app).put(BASE).set(auth(token)).send({ nearbyRadiusKm: 3 });
    expect(res.status).toBe(400);
  });

  it("PUT / con notifyNearby=true sin consentimiento responde 409 y no persiste", async () => {
    const res = await request(app).put(BASE).set(auth(token)).send({ notifyNearby: true, notifyMatch: true });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(CONSENT_MSG);
    const get = await request(app).get(BASE).set(auth(token));
    expect(get.body.notifyNearby).toBe(false);
    expect(get.body.notifyMatch).toBe(false);
  });

  it("PUT /location-consent con status inválido responde 400", async () => {
    const res = await request(app).put(`${BASE}/location-consent`).set(auth(token)).send({ status: "maybe" });
    expect(res.status).toBe(400);
  });

  it("PUT /location sin consentimiento responde 403", async () => {
    const res = await request(app).put(`${BASE}/location`).set(auth(token)).send({ latitude: -34.6, longitude: -58.4 });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("No diste consentimiento para usar tu ubicación");
  });

  it("PUT /location-consent accepted guarda estado y permite notifyNearby", async () => {
    const res = await request(app).put(`${BASE}/location-consent`).set(auth(token)).send({ status: "accepted" });
    expect(res.status).toBe(200);
    expect(res.body.locationConsentStatus).toBe("accepted");
    expect(res.body.locationConsentAt).not.toBeNull();

    const put = await request(app).put(BASE).set(auth(token)).send({ notifyNearby: true });
    expect(put.status).toBe(200);
    expect(put.body.notifyNearby).toBe(true);
  });

  it("PUT /location con coordenadas inválidas responde 400", async () => {
    for (const body of [
      { latitude: 91, longitude: 0 },
      { latitude: 0, longitude: 181 },
      { latitude: "x", longitude: 0 },
      { latitude: 0 },
    ]) {
      const res = await request(app).put(`${BASE}/location`).set(auth(token)).send(body);
      expect(res.status).toBe(400);
    }
  });

  it("PUT /location con consentimiento guarda y GET la devuelve", async () => {
    const res = await request(app).put(`${BASE}/location`).set(auth(token)).send({ latitude: -34.6037, longitude: -58.3816 });
    expect(res.status).toBe(200);
    expect(res.body.location.latitude).toBeCloseTo(-34.6037, 5);
    expect(res.body.location.longitude).toBeCloseTo(-58.3816, 5);
    expect(res.body.location.updatedAt).toEqual(expect.any(String));

    const get = await request(app).get(BASE).set(auth(token));
    expect(get.body.location.latitude).toBeCloseTo(-34.6037, 5);
    expect(get.body.location.longitude).toBeCloseTo(-58.3816, 5);
  });

  it("aísla los datos entre usuarios", async () => {
    const get = await request(app).get(BASE).set(auth(otherToken));
    expect(get.body.locationConsentStatus).toBeNull();
    expect(get.body.location).toBeNull();

    const put = await request(app).put(`${BASE}/location`).set(auth(otherToken)).send({ latitude: 1, longitude: 1 });
    expect(put.status).toBe(403);

    const mine = await request(app).get(BASE).set(auth(token));
    expect(mine.body.location.latitude).toBeCloseTo(-34.6037, 5);
    expect(await prisma.notificationPreference.count({ where: { userId: otherUserId } })).toBe(0);
  });

  it("PUT /location-consent declined borra ubicación y apaga notifyNearby", async () => {
    const res = await request(app).put(`${BASE}/location-consent`).set(auth(token)).send({ status: "declined" });
    expect(res.status).toBe(200);
    expect(res.body.locationConsentStatus).toBe("declined");
    expect(res.body.notifyNearby).toBe(false);
    expect(res.body.location).toBeNull();
  });
});
