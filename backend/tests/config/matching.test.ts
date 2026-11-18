import { getMatchingConfig } from "../../src/config/matching";

describe("getMatchingConfig", () => {
  // valores calibrados (ADR-0014), ventana de 90 días (#217)
  test("sin variables ⇒ valores por defecto", () => {
    expect(getMatchingConfig({})).toEqual({
      matchThreshold: 0.45,
      notifyThreshold: 0.63,
      radiusMeters: 5000,
      windowDays: 90,
      topK: 5,
    });
  });

  test("lee cada parámetro de su variable", () => {
    expect(
      getMatchingConfig({
        MATCH_THRESHOLD: "0.5",
        NOTIFY_THRESHOLD: "0.7",
        MATCH_RADIUS_METERS: "1000",
        MATCH_WINDOW_DAYS: "30",
        MATCH_TOP_K: "3",
      })
    ).toEqual({ matchThreshold: 0.5, notifyThreshold: 0.7, radiusMeters: 1000, windowDays: 30, topK: 3 });
  });

  test.each([
    ["vacío", ""],
    ["no numérico", "abc"],
    ["NaN", "NaN"],
    ["infinito", "Infinity"],
    ["mayor a 1", "1.5"],
    ["negativo", "-0.1"],
  ])("umbral %s ⇒ valor por defecto", (_label, raw) => {
    const config = getMatchingConfig({ MATCH_THRESHOLD: raw, NOTIFY_THRESHOLD: raw });
    expect(config.matchThreshold).toBe(0.45);
    expect(config.notifyThreshold).toBe(0.63);
  });

  test.each([
    ["vacío", ""],
    ["no numérico", "abc"],
    ["cero", "0"],
    ["negativo", "-5"],
    ["decimal", "2.5"],
  ])("entero %s ⇒ valor por defecto", (_label, raw) => {
    const config = getMatchingConfig({ MATCH_RADIUS_METERS: raw, MATCH_WINDOW_DAYS: raw, MATCH_TOP_K: raw });
    expect(config.radiusMeters).toBe(5000);
    expect(config.windowDays).toBe(90);
    expect(config.topK).toBe(5);
  });

  test("lee process.env por defecto", () => {
    const previous = process.env.MATCH_TOP_K;
    process.env.MATCH_TOP_K = "8";
    try {
      expect(getMatchingConfig().topK).toBe(8);
    } finally {
      if (previous === undefined) delete process.env.MATCH_TOP_K;
      else process.env.MATCH_TOP_K = previous;
    }
  });
});
