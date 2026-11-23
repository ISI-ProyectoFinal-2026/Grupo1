import { accountDeleteSchema, updateProfileSchema } from "../../src/validators/profile.validator";

// perfil propio (#366)
describe("profile.validator updateProfileSchema", () => {
  const parse = (body: unknown) => updateProfileSchema.safeParse(body);

  test.each(["+54 9 11 1234-5678", "(011) 4555-1234", "1145551234", "+5491145551234", "12345678"])(
    "acepta el teléfono %s y lo guarda recortado tal como se escribió",
    (phone) => {
      expect(parse({ phone: `  ${phone}  ` })).toEqual({ success: true, data: { phone } });
    }
  );

  test.each([
    ["menos de 8 dígitos", "1234567"],
    ["más de 15 dígitos", "1234567890123456"],
    ["letras", "11-ABCD-5678"],
    ["un + que no va al principio", "54+91112345678"],
    ["dos +", "++5491112345678"],
    ["caracteres no permitidos", "11.4555.1234"],
    ["un string enorme", `1${" ".repeat(100)}1234567`],
  ])("rechaza un teléfono con %s", (_case, phone) => {
    expect(parse({ phone }).success).toBe(false);
  });

  test.each(["", "   ", null])("el teléfono %p lo borra", (phone) => {
    expect(parse({ phone })).toEqual({ success: true, data: { phone: null } });
  });

  test("recorta el nombre y acepta null", () => {
    expect(parse({ fullName: "  Ana Pérez  " })).toEqual({ success: true, data: { fullName: "Ana Pérez" } });
    expect(parse({ fullName: null })).toEqual({ success: true, data: { fullName: null } });
  });

  test.each([
    ["vacío", "   "],
    ["de más de 100 caracteres", "a".repeat(101)],
    ["que no es texto", 42],
  ])("rechaza un nombre %s", (_case, fullName) => {
    expect(parse({ fullName }).success).toBe(false);
  });

  test("exige al menos un campo", () => {
    expect(parse({}).success).toBe(false);
  });

  test.each([{ role: "admin" }, { email: "otro@example.com" }, { fullName: "Ana", tokenVersion: 0 }])(
    "rechaza campos fuera de la whitelist: %p",
    (body) => {
      expect(parse(body).success).toBe(false);
    }
  );
});

describe("profile.validator accountDeleteSchema", () => {
  const parse = (body: unknown) => accountDeleteSchema.safeParse(body);

  test("acepta la contraseña sola o con código", () => {
    expect(parse({ password: "x" })).toEqual({ success: true, data: { password: "x" } });
    expect(parse({ password: "x", code: " 123456 " })).toEqual({ success: true, data: { password: "x", code: "123456" } });
  });

  test.each([{}, { password: "" }, { code: "123456" }, { password: "x", code: "" }, { password: "x", extra: true }])(
    "rechaza %p",
    (body) => {
      expect(parse(body).success).toBe(false);
    }
  );
});
