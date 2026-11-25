import { getRedisUrl, warnIfRedisMissing } from "../../src/config/redis";

describe("getRedisUrl (#177)", () => {
  test.each([
    ["sin definir", undefined],
    ["vacía", ""],
    ["solo espacios", "   "],
  ])("REDIS_URL %s ⇒ undefined (pipeline en proceso)", (_label, raw) => {
    expect(getRedisUrl({ REDIS_URL: raw })).toBeUndefined();
  });

  test("con REDIS_URL devuelve la URL sin espacios", () => {
    expect(getRedisUrl({ REDIS_URL: " redis://localhost:6379 " })).toBe("redis://localhost:6379");
  });
});

describe("warnIfRedisMissing (#177)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("sin REDIS_URL advierte que el pipeline IA corre en proceso, sin cola", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    warnIfRedisMissing({});

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toEqual(expect.stringContaining("REDIS_URL"));
  });

  test("con REDIS_URL no advierte nada", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    warnIfRedisMissing({ REDIS_URL: "redis://localhost:6379" });

    expect(warn).not.toHaveBeenCalled();
  });
});
