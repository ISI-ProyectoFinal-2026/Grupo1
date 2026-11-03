import { getAiServiceStatus, pingAiService, warnIfAiServiceMissing } from "../../src/config/ai-service";

describe("getAiServiceStatus", () => {
  test.each([
    ["sin definir", undefined],
    ["vacía", ""],
    ["solo espacios", "   "],
  ])("AI_SERVICE_URL %s ⇒ not_configured", (_label, raw) => {
    expect(getAiServiceStatus({ AI_SERVICE_URL: raw })).toBe("not_configured");
  });

  test("con AI_SERVICE_URL ⇒ configured", () => {
    expect(getAiServiceStatus({ AI_SERVICE_URL: "http://localhost:8000" })).toBe("configured");
  });
});

describe("warnIfAiServiceMissing (#220)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("sin AI_SERVICE_URL registra una advertencia que explica el efecto", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    warnIfAiServiceMissing({});

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toEqual(expect.stringContaining("AI_SERVICE_URL"));
    expect(warn.mock.calls[0][0]).toEqual(expect.stringContaining("pending"));
  });

  test("con AI_SERVICE_URL no advierte nada", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    warnIfAiServiceMissing({ AI_SERVICE_URL: "http://localhost:8000" });

    expect(warn).not.toHaveBeenCalled();
  });
});

describe("pingAiService", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("sin AI_SERVICE_URL devuelve not_configured sin llamar a fetch", async () => {
    await expect(pingAiService({})).resolves.toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("consulta AI_SERVICE_URL/health con timeout y devuelve ok si responde 2xx", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await expect(pingAiService({ AI_SERVICE_URL: "http://localhost:8000" })).resolves.toBe("ok");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/health");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  test("devuelve unavailable si responde con error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    await expect(pingAiService({ AI_SERVICE_URL: "http://localhost:8000" })).resolves.toBe("unavailable");
  });

  test("devuelve unavailable ante un error de red o timeout", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(pingAiService({ AI_SERVICE_URL: "http://localhost:8000" })).resolves.toBe("unavailable");
  });
});
