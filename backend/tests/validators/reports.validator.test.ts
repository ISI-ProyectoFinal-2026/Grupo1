import { createReportSchema, updateReportSchema } from "../../src/validators/reports.validator";

// consentimiento del teléfono en el flyer (#259)
describe("reports.validator showPhoneOnFlyer", () => {
  const base = {
    reportType: "lost",
    title: "Perro perdido",
    imageUrl: "https://pub-test.r2.dev/pets/a.jpg",
    location: { lat: -34.6, lng: -58.38 },
  };
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("create acepta el booleano", () => {
    expect(createReportSchema.parse({ ...base, showPhoneOnFlyer: true }).showPhoneOnFlyer).toBe(true);
  });

  test("create rechaza un valor que no es booleano", () => {
    expect(createReportSchema.safeParse({ ...base, showPhoneOnFlyer: "si" }).success).toBe(false);
  });

  test("update acepta solo el consentimiento", () => {
    expect(updateReportSchema.parse({ showPhoneOnFlyer: false })).toEqual({ showPhoneOnFlyer: false });
  });
});

// fecha del suceso (#259): YYYY-MM-DD, no futura según la fecha de Argentina
describe("reports.validator eventDate", () => {
  const base = {
    reportType: "lost",
    title: "Perro perdido",
    imageUrl: "https://pub-test.r2.dev/pets/a.jpg",
    location: { lat: -34.6, lng: -58.38 },
  };
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    // 2 de noviembre 23:00 en Argentina, 3 de noviembre en UTC
    jest.useFakeTimers({ now: new Date("2026-11-03T02:00:00Z") });
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...originalEnv };
  });

  test("es opcional", () => {
    expect(createReportSchema.parse(base).eventDate).toBeUndefined();
  });

  test("convierte la fecha a medianoche UTC", () => {
    expect(createReportSchema.parse({ ...base, eventDate: "2026-09-01" }).eventDate).toEqual(
      new Date("2026-09-01T00:00:00.000Z")
    );
  });

  test("acepta el día de hoy en Argentina", () => {
    expect(createReportSchema.safeParse({ ...base, eventDate: "2026-11-02" }).success).toBe(true);
  });

  test("rechaza una fecha futura en Argentina aunque ya sea ese día en UTC", () => {
    expect(createReportSchema.safeParse({ ...base, eventDate: "2026-11-03" }).success).toBe(false);
  });

  test.each(["01/09/2026", "2026-02-30", "2026-9-1", "2026-09-01T10:00:00Z", ""])("rechaza %p", (eventDate) => {
    expect(createReportSchema.safeParse({ ...base, eventDate }).success).toBe(false);
  });

  test("update acepta solo la fecha y también la valida", () => {
    expect(updateReportSchema.parse({ eventDate: "2026-10-31" })).toEqual({
      eventDate: new Date("2026-10-31T00:00:00.000Z"),
    });
    expect(updateReportSchema.safeParse({ eventDate: "2026-12-01" }).success).toBe(false);
  });
});
