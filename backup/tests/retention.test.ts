import { dumpFileName } from "../src/dump-name";
import { isoWeekKey, planRetention } from "../src/retention";

function dump(iso: string): string {
  return dumpFileName(new Date(iso));
}

// un dump diario a las 06:00 UTC durante `days` días terminando en `lastDay`
function dailyDumps(lastDay: string, days: number): string[] {
  const end = new Date(`${lastDay}T06:00:00Z`).getTime();
  return Array.from({ length: days }, (_, i) =>
    dumpFileName(new Date(end - i * 24 * 3600 * 1000))
  );
}

describe("isoWeekKey", () => {
  it.each([
    ["2026-11-16T00:00:00Z", "2026-W47"], // lunes
    ["2026-11-15T23:59:59Z", "2026-W46"], // domingo
    ["2021-01-03T12:00:00Z", "2020-W53"], // enero que pertenece al año ISO anterior
    ["2024-12-30T12:00:00Z", "2025-W01"], // diciembre que pertenece al año ISO siguiente
  ])("%s -> %s", (iso, key) => {
    expect(isoWeekKey(new Date(iso))).toBe(key);
  });
});

describe("planRetention", () => {
  it("con lista vacía no conserva ni borra nada", () => {
    expect(planRetention([])).toEqual({ keep: [], remove: [] });
  });

  it("con menos de 7 dumps los conserva todos", () => {
    const names = dailyDumps("2026-11-15", 5);
    const plan = planRetention(names);
    expect(plan.remove).toEqual([]);
    expect(plan.keep.sort()).toEqual([...names].sort());
  });

  it("conserva 7 diarios + 4 semanales y borra el resto", () => {
    // 2026-11-15 es domingo; 60 días hacia atrás
    const names = dailyDumps("2026-11-15", 60);
    const plan = planRetention(names);

    const expectedKeep = [
      // 7 diarios: 09/11 a 15/11 (semana 46 completa)
      ...dailyDumps("2026-11-15", 7),
      // semanales: el más reciente de cada una de las últimas 4 semanas ISO (domingos)
      dump("2026-11-08T06:00:00Z"), // W45
      dump("2026-11-01T06:00:00Z"), // W44
      dump("2026-10-25T06:00:00Z"), // W43
    ];
    // W46 ya está cubierta por el diario del 15/11
    expect(plan.keep.sort()).toEqual(expectedKeep.sort());
    expect(plan.remove).toHaveLength(60 - expectedKeep.length);
    expect(plan.keep.length + plan.remove.length).toBe(60);
  });

  it("con varios dumps el mismo día conserva solo el último de cada día", () => {
    const names = [
      dump("2026-11-15T06:00:00Z"),
      dump("2026-11-15T18:30:00Z"),
      dump("2026-11-14T06:00:00Z"),
      dump("2026-11-14T07:00:00Z"),
    ];
    const plan = planRetention(names);
    expect(plan.keep.sort()).toEqual(
      [dump("2026-11-15T18:30:00Z"), dump("2026-11-14T07:00:00Z")].sort()
    );
    expect(plan.remove.sort()).toEqual(
      [dump("2026-11-15T06:00:00Z"), dump("2026-11-14T06:00:00Z")].sort()
    );
  });

  it("cuenta días con dumps, no días de calendario (huecos no borran de más)", () => {
    // un dump cada 10 días: los 7 más recientes siguen siendo diarios
    const names = Array.from({ length: 9 }, (_, i) =>
      dumpFileName(new Date(Date.UTC(2026, 10, 15 - i * 10, 6)))
    );
    const plan = planRetention(names);
    const newestFirst = [...names].sort().reverse();
    expect(plan.keep.sort()).toEqual(newestFirst.slice(0, 7).sort());
    expect(plan.remove.sort()).toEqual(newestFirst.slice(7).sort());
  });

  it("separa las semanas ISO en el límite domingo/lunes y toma el último de cada una", () => {
    // 2026-11-04 a 2026-11-10: 7 diarios
    const recent = dailyDumps("2026-11-10", 7);
    const w44Monday = dump("2026-10-26T06:00:00Z");
    const w44Saturday = dump("2026-10-31T06:00:00Z");
    const w44Sunday = dump("2026-11-01T23:59:00Z"); // último de W44
    const w45Monday = dump("2026-11-02T00:01:00Z"); // primero de W45, único fuera de los diarios
    const plan = planRetention([...recent, w44Monday, w44Saturday, w44Sunday, w45Monday]);

    // W46 y W45 quedan cubiertas por diarios (10/11 y 08/11); W44 aporta su domingo
    expect(plan.keep.sort()).toEqual([...recent, w44Sunday].sort());
    expect(plan.remove.sort()).toEqual([w44Monday, w44Saturday, w45Monday].sort());
  });

  it("ignora nombres que no son dumps (ni los conserva ni los borra)", () => {
    const names = [...dailyDumps("2026-11-15", 3), "README.txt", "patitas-x.dump.partial"];
    const plan = planRetention(names);
    expect(plan.keep).not.toContain("README.txt");
    expect(plan.remove).not.toContain("README.txt");
    expect(plan.remove).not.toContain("patitas-x.dump.partial");
  });

  it("respeta cantidades configurables", () => {
    const names = dailyDumps("2026-11-15", 30);
    const plan = planRetention(names, { daily: 2, weekly: 1 });
    expect(plan.keep.sort()).toEqual(dailyDumps("2026-11-15", 2).sort());
  });
});
