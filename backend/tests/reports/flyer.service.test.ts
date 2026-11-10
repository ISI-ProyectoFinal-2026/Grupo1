import { FlyerDetails, composeFlyer, flyerInfoRows, flyerLayout, flyerTone, wrapLines } from "../../src/services/flyer.service";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { ReportDTO } from "../../src/services/reports.service";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function buildReport(overrides: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: 1,
    userId: 1,
    petId: null,
    reportType: "lost",
    status: "published",
    title: "Gato gris perdido en San Telmo",
    description: "Collar rojo, muy asustadizo",
    imageUrl: null,
    extraImageUrls: [],
    customFlyerUrl: null,
    locationAddress: "San Telmo, CABA",
    showPhoneOnFlyer: false,
    eventDate: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date(),
    publishedAt: new Date(),
    location: { lat: -34.6, lng: -58.37 },
    tag: { label: "PERDIDO", color: "#EF4444" },
    ...overrides,
  };
}

describe("composeFlyer", () => {
  test("genera un PNG válido cuando no hay foto de la mascota", () => {
    const buffer = composeFlyer(buildReport(), null);

    expect(buffer.subarray(0, 4)).toEqual(PNG_SIGNATURE);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  test("no revienta con títulos y descripciones largas (wrap de texto)", () => {
    const report = buildReport({
      title: "Perro mestizo color marrón con manchas blancas visto por última vez cerca de la estación",
      description:
        "Es muy manso, responde al nombre de Toby, tiene una cicatriz en la pata trasera izquierda y un collar azul desgastado",
    });

    const buffer = composeFlyer(report, null);

    expect(buffer.subarray(0, 4)).toEqual(PNG_SIGNATURE);
  });

  test("no revienta sin descripción ni dirección", () => {
    const report = buildReport({ description: null, locationAddress: null });

    const buffer = composeFlyer(report, null);

    expect(buffer.subarray(0, 4)).toEqual(PNG_SIGNATURE);
  });

  test("usa el color del tag correspondiente para reportes RESUELTO", () => {
    const lost = composeFlyer(buildReport(), null);
    const resolved = composeFlyer(
      buildReport({ tag: { label: "RESUELTO", color: "#22C55E" } }),
      null
    );

    // Distinto color de banda superior -> distintos bytes en el PNG resultante.
    expect(resolved.equals(lost)).toBe(false);
  });
});

// datos de la mascota y contacto (#259)
const FULL_DETAILS: FlyerDetails = {
  petName: "Firulais",
  petBreed: "Labrador",
  petColor: "Marrón",
  phone: "11 5555-5555",
};
const NO_DETAILS: FlyerDetails = { petName: null, petBreed: null, petColor: null, phone: null };

describe("flyerInfoRows", () => {
  test("con todos los datos: mascota, zona, fecha del suceso y teléfono, cada uno con su ícono", () => {
    expect(flyerInfoRows(buildReport(), FULL_DETAILS)).toEqual([
      { icon: "paw", text: "Firulais · Labrador · Marrón" },
      { icon: "pin", text: "San Telmo, CABA" },
      { icon: "calendar", text: "Se perdió el 01/09/2026" },
      { icon: "phone", text: "11 5555-5555" },
    ]);
  });

  test("sin datos opcionales solo queda la fecha, sin huecos ni 'null'", () => {
    const rows = flyerInfoRows(buildReport({ locationAddress: null }), NO_DETAILS);

    expect(rows).toEqual([{ icon: "calendar", text: "Se perdió el 01/09/2026" }]);
    expect(JSON.stringify(rows)).not.toMatch(/null|undefined/);
  });

  test("omite solo los datos de la mascota que faltan", () => {
    const rows = flyerInfoRows(buildReport(), { ...NO_DETAILS, petBreed: "Labrador" });

    expect(rows[0]).toEqual({ icon: "paw", text: "Labrador" });
  });

  test("usa la fecha del suceso cuando está cargada", () => {
    const rows = flyerInfoRows(buildReport({ eventDate: "2026-08-15" }), NO_DETAILS);

    expect(rows).toContainEqual({ icon: "calendar", text: "Se perdió el 15/08/2026" });
  });

  test("un reporte de hallazgo usa la fecha en que se encontró", () => {
    const rows = flyerInfoRows(buildReport({ reportType: "found" }), NO_DETAILS);

    expect(rows).toContainEqual({ icon: "calendar", text: "Se encontró el 01/09/2026" });
  });

  test("ignora textos en blanco", () => {
    const rows = flyerInfoRows(buildReport({ locationAddress: "  " }), { ...NO_DETAILS, phone: " ", petName: "" });

    expect(rows.map((row) => row.icon)).toEqual(["calendar"]);
  });
});

describe("composeFlyer con datos de la mascota (#259)", () => {
  test("genera un PNG válido con todos los datos opcionales", () => {
    const buffer = composeFlyer(buildReport(), null, FULL_DETAILS);

    expect(buffer.subarray(0, 4)).toEqual(PNG_SIGNATURE);
  });

  test("no revienta con datos muy largos", () => {
    const long = "Nombre larguísimo de una mascota con muchas palabras ".repeat(4);
    const buffer = composeFlyer(
      buildReport({ title: long, description: long, locationAddress: long }),
      null,
      { petName: long, petBreed: long, petColor: long, phone: long }
    );

    expect(buffer.subarray(0, 4)).toEqual(PNG_SIGNATURE);
  });

  test("el teléfono cambia el flyer: solo se dibuja si llega en los datos", () => {
    const withPhone = composeFlyer(buildReport(), null, FULL_DETAILS);
    const withoutPhone = composeFlyer(buildReport(), null, { ...FULL_DETAILS, phone: null });

    expect(withPhone.equals(withoutPhone)).toBe(false);
  });

  test("sin datos de la mascota es igual que no pasarlos", () => {
    expect(composeFlyer(buildReport(), null, NO_DETAILS).equals(composeFlyer(buildReport(), null))).toBe(true);
  });
});

// corte de líneas del título y la descripción
describe("wrapLines", () => {
  // 10px por caracter: 100px = 10 caracteres
  const measure = (text: string) => Array.from(text).length * 10;

  test("un texto corto queda en una línea", () => {
    expect(wrapLines("Firulais", 100, 2, measure)).toEqual(["Firulais"]);
  });

  test("corta en los espacios sin pasarse del ancho", () => {
    expect(wrapLines("uno dos tres cuatro", 100, 3, measure)).toEqual(["uno dos", "tres", "cuatro"]);
  });

  test("si sobra texto, la última línea termina en '…'", () => {
    expect(wrapLines("uno dos tres cuatro", 100, 2, measure)).toEqual(["uno dos", "tres…"]);
  });

  test("el '…' entra en el ancho aunque la última línea esté llena", () => {
    const lines = wrapLines("abcdefghij klmnopqrst uvw", 100, 2, measure);

    expect(lines).toEqual(["abcdefghij", "klmnopqrs…"]);
  });

  test("parte una palabra más ancha que la línea", () => {
    expect(wrapLines("abcdefghijklmnopqrstuvwxy", 100, 3, measure)).toEqual([
      "abcdefghij",
      "klmnopqrst",
      "uvwxy",
    ]);
  });

  test("parte y trunca una palabra que no entra en las líneas disponibles", () => {
    const lines = wrapLines("x".repeat(500), 100, 2, measure);

    expect(lines).toEqual(["x".repeat(10), `${"x".repeat(9)}…`]);
  });

  test("ninguna línea supera el ancho", () => {
    const text = "Perro https://ejemplo.com/una/url/larguisima/sin/espacios mestizo con collar";
    for (const line of wrapLines(text, 100, 4, measure)) {
      expect(measure(line)).toBeLessThanOrEqual(100);
    }
  });

  test("un texto vacío no genera líneas", () => {
    expect(wrapLines("   ", 100, 2, measure)).toEqual([]);
  });
});

// fotos extra como miniaturas
describe("composeFlyer con fotos extra", () => {
  async function solidImage(color: string) {
    const c = createCanvas(40, 40);
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 40, 40);
    return loadImage(c.toBuffer("image/png"));
  }

  test("las miniaturas cambian el flyer", async () => {
    const main = await solidImage("#888888");
    const extra = await solidImage("#00FF00");

    const without = composeFlyer(buildReport(), main, NO_DETAILS, []);
    const withExtras = composeFlyer(buildReport(), main, NO_DETAILS, [extra, extra]);

    expect(withExtras.subarray(0, 4)).toEqual(PNG_SIGNATURE);
    expect(withExtras.equals(without)).toBe(false);
  });

  test("dibuja como máximo 3 miniaturas", async () => {
    const main = await solidImage("#888888");
    const a = await solidImage("#00FF00");
    const b = await solidImage("#FF00FF");

    const three = composeFlyer(buildReport(), main, NO_DETAILS, [a, a, a]);
    const four = composeFlyer(buildReport(), main, NO_DETAILS, [a, a, a, b]);

    expect(four.equals(three)).toBe(true);
  });
});

// color de estado: tonos del sistema para las etiquetas conocidas
describe("flyerTone", () => {
  test.each([
    ["PERDIDO", "#C4342B"],
    ["ENCONTRADO", "#2457A6"],
    ["RESUELTO", "#1F7A4D"],
    [" perdido ", "#C4342B"],
  ])("%s usa el tono del sistema", (label, tone) => {
    expect(flyerTone({ label, color: "#EF4444" })).toBe(tone);
  });

  test("una etiqueta desconocida conserva el color de la API", () => {
    expect(flyerTone({ label: "EN TRÁNSITO", color: "#123456" })).toBe("#123456");
  });
});

// reparto vertical: sin bandas vacías
describe("flyerLayout", () => {
  const HEIGHT = 1920;

  function sections(layout: ReturnType<typeof flyerLayout>) {
    return [layout.header, layout.photo, ...(layout.thumbs ? [layout.thumbs] : []), layout.info, layout.footer];
  }

  test.each([true, false])("las secciones cubren todo el alto sin huecos (extras: %s)", (hasExtras) => {
    const parts = sections(flyerLayout({ hasExtras, infoHeight: 420 }));

    expect(parts[0].y).toBe(0);
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].y).toBe(parts[i - 1].y + parts[i - 1].height);
    }
    const last = parts[parts.length - 1];
    expect(last.y + last.height).toBe(HEIGHT);
  });

  test("sin fotos extra no hay tira de miniaturas y la foto gana ese espacio", () => {
    const withExtras = flyerLayout({ hasExtras: true, infoHeight: 420 });
    const without = flyerLayout({ hasExtras: false, infoHeight: 420 });

    expect(without.thumbs).toBeNull();
    expect(withExtras.thumbs).not.toBeNull();
    expect(without.photo.height).toBeGreaterThan(withExtras.photo.height);
  });

  test("la foto absorbe el espacio que no usa la información", () => {
    const short = flyerLayout({ hasExtras: false, infoHeight: 300 });
    const long = flyerLayout({ hasExtras: false, infoHeight: 500 });

    expect(short.photo.height - long.photo.height).toBe(200);
  });

  test("la foto es protagonista aun con información larga y fotos extra", () => {
    const layout = flyerLayout({ hasExtras: true, infoHeight: 560 });

    expect(layout.photo.height).toBeGreaterThanOrEqual(HEIGHT * 0.27);
    expect(layout.photo.height + (layout.thumbs?.height ?? 0)).toBeGreaterThanOrEqual(HEIGHT * 0.44);
  });
});
