import { triggerEmbeddingGeneration } from "../../src/services/matching.service";

describe("matching.service", () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    // @ts-expect-error -- test double, no necesita implementar el tipo completo de fetch
    global.fetch = fetchMock;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test("no llama a fetch si AI_SERVICE_URL no está configurada", () => {
    delete process.env.AI_SERVICE_URL;

    triggerEmbeddingGeneration(1, "https://cdn.example.com/foto.jpg");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("hace POST a AI_SERVICE_URL/reports/:id/embedding con el body correcto", () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ ok: true });

    triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/reports/42/embedding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: "https://cdn.example.com/foto.jpg" }),
    });
  });

  test("un fetch que rechaza no lanza ni genera un unhandled rejection", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockRejectedValue(new Error("network down"));

    expect(() => triggerEmbeddingGeneration(1, "https://cdn.example.com/foto.jpg")).not.toThrow();

    // deja que el .catch() interno procese el rechazo antes de que termine el test
    await new Promise((resolve) => setImmediate(resolve));
  });
});
