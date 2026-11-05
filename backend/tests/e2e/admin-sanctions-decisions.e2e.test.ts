import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { sanctionClock } from "../../src/services/account-sanctions/clock";
import { isAuthorSuspended } from "../../src/services/account-sanctions/visibility";
import * as adminsModule from "../../src/services/account-sanctions/admins";
import * as mailModule from "../../src/services/mail";
import { createE2EContext, E2E_PASSWORD, E2EUser, promoteTo } from "./helpers/factories";

type Severity = "mild" | "moderate" | "severe";

describe("E2E: decisiones del admin sobre sanciones", () => {
  const ctx = createE2EContext("admin-sanctions-decisions");
  const auth = (user: E2EUser) => ({ Authorization: `Bearer ${user.token}` });
  const T0 = new Date("2026-03-10T12:00:00.000Z");
  const SUSPENDED_SUBJECT = "Tu cuenta de PATITAS fue suspendida";
  const REINSTATED_SUBJECT = "Tu cuenta de PATITAS fue reactivada";
  const send = jest.fn();

  let reporters: E2EUser[];
  let admin: E2EUser;

  const fileReports = async (target: E2EUser, severities: Severity[]) => {
    for (const [i, severity] of severities.entries()) {
      const res = await request(app)
        .post("/api/account-reports")
        .set(auth(reporters[i]))
        .send({ reportedUserId: target.id, severity });
      expect(res.status).toBe(201);
    }
  };
  const decide = (actor: E2EUser, sanctionId: number, action: "confirm" | "revert", body: object = { reason: "revisado" }) =>
    request(app).post(`/api/admin/account-sanctions/${sanctionId}/${action}`).set(auth(actor)).send(body);
  const sanctionOf = (userId: number) => prisma.accountSanction.findFirstOrThrow({ where: { userId } });
  const eventsOf = (sanctionId: number) =>
    prisma.accountSanctionEvent.findMany({ where: { sanctionId }, orderBy: { id: "asc" } });
  const mailsWithSubject = (subject: string) => send.mock.calls.map(([m]) => m).filter((m) => m.subject === subject);
  const login = (email: string) => request(app).post("/api/auth/login").send({ email, password: E2E_PASSWORD });
  const staffCase = async (label: string, role: Role, severities: Severity[]) => {
    const staff = await ctx.registerAndLogin(label);
    await promoteTo(staff.id, role);
    await fileReports(staff, severities);
    return { staff, sanction: await sanctionOf(staff.id) };
  };
  const severeCase = async (label: string) => {
    const target = await ctx.registerAndLogin(label);
    await fileReports(target, ["severe", "severe", "severe", "severe", "severe"]);
    return { target, sanction: await sanctionOf(target.id) };
  };

  beforeAll(async () => {
    reporters = [];
    for (let i = 0; i < 5; i++) reporters.push(await ctx.registerAndLogin(`reporter-${i}`));
    admin = await ctx.registerAndLogin("admin");
    await promoteTo(admin.id, "admin");
  }, 90_000);

  beforeEach(() => {
    send.mockReset().mockResolvedValue(undefined);
    jest.spyOn(sanctionClock, "now").mockReturnValue(T0);
    jest.spyOn(mailModule, "getMailSender").mockReturnValue({ send });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await prisma.$disconnect();
  });

  describe("confirmar", () => {
    test("moderada de un moderador: 1 mes + advertencia, rol intacto, evento del admin y mail", async () => {
      const { staff, sanction } = await staffCase("confirm-moderate", "moderador", [
        "moderate", "moderate", "moderate", "moderate", "moderate",
      ]);

      const res = await decide(admin, sanction.id, "confirm", { reason: "corresponde" });

      expect(res.status).toBe(200);
      expect(await sanctionOf(staff.id)).toMatchObject({
        status: "active",
        kind: "temporary",
        warning: true,
        endsAt: new Date("2026-04-10T12:00:00.000Z"),
      });
      expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).role).toBe("moderador");
      expect((await eventsOf(sanction.id)).map((e) => [e.type, e.actorId, e.reason])).toEqual([
        ["created", null, null],
        ["confirmed", admin.id, "corresponde"],
      ]);
      expect(mailsWithSubject(SUSPENDED_SUBJECT)).toHaveLength(1);
      const next = await login(staff.email);
      expect(next.status).toBe(403);
      expect(next.body.error.code).toBe("ACCOUNT_SUSPENDED");
    });

    test("grave de un moderador: queda provisional activa y vuelve a la cola como caso de eliminación", async () => {
      const { staff, sanction } = await staffCase("confirm-severe", "moderador", [
        "severe", "severe", "severe", "severe", "severe",
      ]);

      expect((await decide(admin, sanction.id, "confirm")).status).toBe(200);

      expect(await sanctionOf(staff.id)).toMatchObject({ status: "active", kind: "provisional", endsAt: null });
      const queue = await request(app).get("/api/admin/account-sanctions/pending").set(auth(admin));
      expect(queue.body.items.find((i: { account: { id: number } }) => i.account.id === staff.id)).toMatchObject({
        status: "active",
        kind: "provisional",
      });
    });

    test("provisional confirmada: permanente, datos intactos y login rechazado como permanente", async () => {
      const { target, sanction } = await severeCase("confirm-permanent");

      const res = await decide(admin, sanction.id, "confirm", { reason: "baja definitiva" });

      expect(res.status).toBe(200);
      expect(await sanctionOf(target.id)).toMatchObject({ status: "active", kind: "permanent", endsAt: null });
      expect(await prisma.user.count({ where: { id: target.id } })).toBe(1);
      const next = await login(target.email);
      expect(next.status).toBe(403);
      expect(next.body.error.details).toMatchObject({ type: "permanent" });
      expect((await eventsOf(sanction.id)).map((e) => e.type)).toEqual(["created", "confirmed"]);
      expect(mailsWithSubject(SUSPENDED_SUBJECT)).toHaveLength(2);
    });

    test("un admin como objetivo, habiendo otro admin activo, se puede sancionar", async () => {
      const { staff, sanction } = await staffCase("confirm-admin", "admin", ["mild", "mild", "mild", "mild", "mild"]);

      expect((await decide(admin, sanction.id, "confirm")).status).toBe(200);

      expect(await sanctionOf(staff.id)).toMatchObject({ status: "active" });
      expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).role).toBe("admin");
    });

    test("el último admin activo no se sanciona: 409 LAST_ADMIN y nada cambia", async () => {
      const { sanction } = await staffCase("last-admin", "admin", ["mild", "mild", "mild", "mild", "mild"]);
      jest.spyOn(adminsModule, "countOtherActiveAdmins").mockResolvedValue(0);

      const res = await decide(admin, sanction.id, "confirm");

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("LAST_ADMIN");
      expect((await prisma.accountSanction.findUniqueOrThrow({ where: { id: sanction.id } })).status).toBe("pending_review");
      expect((await eventsOf(sanction.id)).map((e) => e.type)).toEqual(["created"]);
      expect(mailsWithSubject(SUSPENDED_SUBJECT)).toHaveLength(0);
    });
  });

  describe("revertir", () => {
    test("caso de staff: dismissed, evento del admin, sin sanción ni mail y la cuenta sigue entrando", async () => {
      const { staff, sanction } = await staffCase("revert-staff", "moderador", [
        "moderate", "moderate", "moderate", "moderate", "moderate",
      ]);

      send.mockClear();

      const res = await decide(admin, sanction.id, "revert", { reason: "falsa alarma" });

      expect(res.status).toBe(200);
      expect((await sanctionOf(staff.id)).status).toBe("dismissed");
      expect((await eventsOf(sanction.id)).map((e) => [e.type, e.actorId, e.reason])).toEqual([
        ["created", null, null],
        ["dismissed", admin.id, "falsa alarma"],
      ]);
      expect(send).not.toHaveBeenCalled();
      expect((await login(staff.email)).status).toBe(200);
    });

    test("provisional: reverted, contenido visible, mail de reactivación y el token viejo sigue muerto", async () => {
      const { target, sanction } = await severeCase("revert-severe");
      expect(await isAuthorSuspended(target.id)).toBe(true);
      send.mockClear();

      const res = await decide(admin, sanction.id, "revert", { reason: "error" });

      expect(res.status).toBe(200);
      expect((await sanctionOf(target.id)).status).toBe("reverted");
      expect(await isAuthorSuspended(target.id)).toBe(false);
      expect((await eventsOf(sanction.id)).map((e) => [e.type, e.actorId])).toEqual([
        ["created", null],
        ["reverted", admin.id],
      ]);
      const mails = mailsWithSubject(REINSTATED_SUBJECT);
      expect(mails).toHaveLength(1);
      expect(mails[0].to).toBe(target.email);
      expect((await request(app).get("/api/auth/me").set(auth(target))).status).toBe(401);
      expect((await login(target.email)).status).toBe(200);
    });
  });

  describe("errores y concurrencia", () => {
    test("caso inexistente: 404", async () => {
      expect((await decide(admin, 2147483000, "confirm")).status).toBe(404);
      expect((await decide(admin, 2147483000, "revert")).status).toBe(404);
    });

    test("caso ya decidido: 409 SANCTION_ALREADY_DECIDED", async () => {
      const { sanction } = await severeCase("decided");
      await decide(admin, sanction.id, "revert");

      for (const action of ["confirm", "revert"] as const) {
        const res = await decide(admin, sanction.id, action);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("SANCTION_ALREADY_DECIDED");
      }
    });

    test("una suspensión temporal automática no es un caso decidible", async () => {
      const target = await ctx.registerAndLogin("not-a-case");
      await fileReports(target, ["mild", "mild", "mild", "mild", "mild"]);

      const res = await decide(admin, (await sanctionOf(target.id)).id, "confirm");

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("SANCTION_ALREADY_DECIDED");
    });

    test("decidir sobre el propio caso: 403 SELF_SANCTION_DECISION", async () => {
      const { staff, sanction } = await staffCase("self", "admin", ["mild", "mild", "mild", "mild", "mild"]);

      for (const action of ["confirm", "revert"] as const) {
        const res = await decide(staff, sanction.id, action);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("SELF_SANCTION_DECISION");
      }
      expect((await sanctionOf(staff.id)).status).toBe("pending_review");
    });

    test("un moderador recibe 403 y un cuerpo sin motivo, 400", async () => {
      const { target, sanction } = await severeCase("authz");
      const moderator = await ctx.registerAndLogin("authz-mod");
      await promoteTo(moderator.id, "moderador");

      expect((await decide(moderator, sanction.id, "confirm")).status).toBe(403);
      expect((await decide(admin, sanction.id, "confirm", {})).status).toBe(400);
      expect((await sanctionOf(target.id)).kind).toBe("provisional");
    });

    test("decisiones simultáneas: una prospera y la otra recibe SANCTION_ALREADY_DECIDED", async () => {
      const { target, sanction } = await severeCase("concurrent");

      const results = await Promise.all([decide(admin, sanction.id, "confirm"), decide(admin, sanction.id, "revert")]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(results.find((r) => r.status === 409)!.body.error.code).toBe("SANCTION_ALREADY_DECIDED");
      const decided = (await eventsOf(sanction.id)).filter((e) => e.type !== "created");
      expect(decided).toHaveLength(1);
      expect((await sanctionOf(target.id)).status).toBe(decided[0].type === "confirmed" ? "active" : "reverted");
    });
  });

  describe("countOtherActiveAdmins", () => {
    test("deja de contar a un admin con suspensión vigente", async () => {
      const other = await ctx.registerAndLogin("count-other");
      await promoteTo(other.id, "admin");
      // snapshot estable: otras suites pueden crear admins en paralelo
      const { before, during, afterExpiry } = await prisma.$transaction(
        async (tx) => {
          const count = (at: Date) => adminsModule.countOtherActiveAdmins(tx, admin.id, at);
          const before = await count(T0);
          await tx.accountSanction.create({
            data: {
              userId: other.id,
              severity: "mild",
              kind: "temporary",
              status: "active",
              reason: "x",
              triggeringReportIds: [],
              startsAt: T0,
              endsAt: new Date("2026-04-10T00:00:00.000Z"),
            },
          });
          return { before, during: await count(T0), afterExpiry: await count(new Date("2026-04-11T00:00:00.000Z")) };
        },
        { isolationLevel: "RepeatableRead" }
      );

      expect(before).toBeGreaterThanOrEqual(1);
      expect(during).toBe(before - 1);
      // otros admins sancionados por la suite también vuelven a contar al vencer
      expect(afterExpiry).toBeGreaterThanOrEqual(before);
      expect(afterExpiry).toBeGreaterThan(during);
    });
  });
});
