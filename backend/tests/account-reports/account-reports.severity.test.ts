import { resolveSeverity } from "../../src/services/account-reports.service";

describe("resolveSeverity (#267)", () => {
  test.each([
    [["mild", "mild", "mild", "moderate", "severe"], "mild"],
    [["moderate", "moderate", "moderate", "severe", "mild"], "moderate"],
    [["severe", "severe", "severe", "mild", "mild"], "severe"],
    [["mild", "mild", "mild", "mild", "mild"], "mild"],
  ] as const)("con %j aplica la más frecuente (%s)", (severities, expected) => {
    expect(resolveSeverity([...severities])).toBe(expected);
  });

  test.each([
    [["mild", "mild", "moderate", "moderate", "severe"], "moderate"],
    [["mild", "mild", "severe", "severe", "moderate"], "severe"],
    [["moderate", "moderate", "severe", "severe", "mild"], "severe"],
  ] as const)("en empate %j aplica la más alta (%s)", (severities, expected) => {
    expect(resolveSeverity([...severities])).toBe(expected);
  });

  test("el orden de las denuncias no cambia el resultado", () => {
    expect(resolveSeverity(["severe", "mild", "moderate", "mild", "moderate"])).toBe("moderate");
    expect(resolveSeverity(["moderate", "mild", "moderate", "severe", "mild"])).toBe("moderate");
  });
});
