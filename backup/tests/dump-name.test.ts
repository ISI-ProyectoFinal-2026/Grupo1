import { dumpFileName, parseDumpDate } from "../src/dump-name";

describe("dumpFileName", () => {
  it("usa el timestamp UTC compacto", () => {
    expect(dumpFileName(new Date("2026-11-15T06:05:09.123Z"))).toBe(
      "patitas-20261115T060509Z.dump"
    );
  });
});

describe("parseDumpDate", () => {
  it("lee la fecha de un nombre válido", () => {
    expect(parseDumpDate("patitas-20261115T060509Z.dump")?.toISOString()).toBe(
      "2026-11-15T06:05:09.000Z"
    );
  });

  it("es la inversa de dumpFileName (a precisión de segundos)", () => {
    const date = new Date("2026-01-02T03:04:05.000Z");
    expect(parseDumpDate(dumpFileName(date))).toEqual(date);
  });

  it.each([
    "patitas-20261115T060509Z.dump.partial",
    "otro-20261115T060509Z.dump",
    "patitas-2026-11-15.dump",
    "patitas-20261399T060509Z.dump",
    "notas.txt",
  ])("devuelve null para %s", (name) => {
    expect(parseDumpDate(name)).toBeNull();
  });
});
