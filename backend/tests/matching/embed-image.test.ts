import { embedImage } from "../../src/services/matching.service";

describe("matching.service embedImage", () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;
  const vector = Array.from({ length: 768 }, (_, i) => i / 768);

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    process.env.INTERNAL_API_KEY = "internal-key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function jsonResponse(status: number, body: unknown) {
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  }

  test("pide el embedding a AI_SERVICE_URL/images/embedding con la clave interna y un timeout", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { embedding: vector }));

    await embedImage("https://cdn.example.com/dog.jpg");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/images/embedding");
    expect(options).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Key": "internal-key" },
        body: JSON.stringify({ image_url: "https://cdn.example.com/dog.jpg" }),
      })
    );
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  test("devuelve el vector de 768 dimensiones", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { embedding: vector }));

    await expect(embedImage("https://cdn.example.com/dog.jpg")).resolves.toEqual(vector);
  });

  test("devuelve null sin llamar a fetch si AI_SERVICE_URL no está configurada", async () => {
    delete process.env.AI_SERVICE_URL;

    await expect(embedImage("https://cdn.example.com/dog.jpg")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("devuelve null ante un error de red, sin reintentar", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(embedImage("https://cdn.example.com/dog.jpg")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("devuelve null ante un timeout", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

    await expect(embedImage("https://cdn.example.com/dog.jpg")).resolves.toBeNull();
  });

  test.each([422, 401, 500])("devuelve null si el Backend IA responde %i", async (status) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(jsonResponse(status, { detail: "error" }));

    await expect(embedImage("https://cdn.example.com/dog.jpg")).resolves.toBeNull();
  });

  test.each([
    ["sin embedding", {}],
    ["dimensión incorrecta", { embedding: [0.1, 0.2] }],
    ["valores no numéricos", { embedding: Array(768).fill("x") }],
  ])("devuelve null si el cuerpo es inválido (%s)", async (_case, body) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(jsonResponse(200, body));

    await expect(embedImage("https://cdn.example.com/dog.jpg")).resolves.toBeNull();
  });
});
