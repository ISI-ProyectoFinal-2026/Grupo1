import { createReportFlagSchema } from "../../src/validators/report-flags.validator";

describe("createReportFlagSchema", () => {
  test.each(["not_an_animal", "offensive", "spam", "duplicate", "false_info"])(
    "acepta %s sin detalle",
    (reason) => {
      expect(createReportFlagSchema.safeParse({ reason }).success).toBe(true);
    }
  );

  test("acepta un motivo con detalle opcional", () => {
    const result = createReportFlagSchema.safeParse({ reason: "spam", detail: "  vende cosas  " });
    expect(result.success).toBe(true);
    expect(result.data?.detail).toBe("vende cosas");
  });

  test("other con detalle es válido", () => {
    expect(createReportFlagSchema.safeParse({ reason: "other", detail: "Otro motivo" }).success).toBe(true);
  });

  test.each([
    ["sin detalle", {}],
    ["detalle vacío", { detail: "" }],
    ["detalle en blanco", { detail: "   " }],
  ])("other %s se rechaza", (_label, extra) => {
    expect(createReportFlagSchema.safeParse({ reason: "other", ...extra }).success).toBe(false);
  });

  test("rechaza un motivo fuera de la lista", () => {
    expect(createReportFlagSchema.safeParse({ reason: "me cae mal" }).success).toBe(false);
  });

  test("rechaza el cuerpo sin motivo", () => {
    expect(createReportFlagSchema.safeParse({}).success).toBe(false);
  });

  test("el detalle admite hasta 500 caracteres", () => {
    expect(createReportFlagSchema.safeParse({ reason: "spam", detail: "a".repeat(500) }).success).toBe(true);
    expect(createReportFlagSchema.safeParse({ reason: "spam", detail: "a".repeat(501) }).success).toBe(false);
  });
});
