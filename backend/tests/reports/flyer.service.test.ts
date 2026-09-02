import { composeFlyer } from "../../src/services/flyer.service";
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
    locationAddress: "San Telmo, CABA",
    createdAt: new Date(),
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
