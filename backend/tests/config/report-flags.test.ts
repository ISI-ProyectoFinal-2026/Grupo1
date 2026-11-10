import { getReportFlagThreshold } from "../../src/config/report-flags";

describe("getReportFlagThreshold", () => {
  test.each([
    ["sin definir", undefined],
    ["vacía", ""],
    ["no numérica", "abc"],
    ["cero", "0"],
    ["negativa", "-3"],
    ["decimal", "2.5"],
    ["NaN", "NaN"],
  ])("REPORT_FLAG_THRESHOLD %s ⇒ 5", (_label, raw) => {
    expect(getReportFlagThreshold({ REPORT_FLAG_THRESHOLD: raw })).toBe(5);
  });

  test("valor entero positivo ⇒ ese valor", () => {
    expect(getReportFlagThreshold({ REPORT_FLAG_THRESHOLD: "3" })).toBe(3);
  });

  test("lee process.env por defecto", () => {
    const previous = process.env.REPORT_FLAG_THRESHOLD;
    process.env.REPORT_FLAG_THRESHOLD = "7";
    try {
      expect(getReportFlagThreshold()).toBe(7);
    } finally {
      if (previous === undefined) delete process.env.REPORT_FLAG_THRESHOLD;
      else process.env.REPORT_FLAG_THRESHOLD = previous;
    }
  });
});
