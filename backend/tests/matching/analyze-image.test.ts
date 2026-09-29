import { analyzeImage } from "../../src/services/matching.service";

describe("matching.service analyzeImage", () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;

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

  test("posts the image URL to AI_SERVICE_URL/images/analyze with the internal key", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { has_animal: true }));

    await analyzeImage("https://cdn.example.com/dog.jpg");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/images/analyze");
    expect(options).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Key": "internal-key" },
        body: JSON.stringify({ image_url: "https://cdn.example.com/dog.jpg" }),
      })
    );
    // A timeout signal keeps a hung AI service from blocking the user's request.
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  test("returns 'animal' when the AI service detects an animal", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { has_animal: true }));

    await expect(analyzeImage("https://cdn.example.com/dog.jpg")).resolves.toBe("animal");
  });

  test("returns 'no_animal' when the AI service detects no animal", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { has_animal: false }));

    await expect(analyzeImage("https://cdn.example.com/landscape.jpg")).resolves.toBe("no_animal");
  });

  test("returns 'unavailable' without calling fetch when AI_SERVICE_URL is not configured", async () => {
    delete process.env.AI_SERVICE_URL;

    await expect(analyzeImage("https://cdn.example.com/dog.jpg")).resolves.toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns 'unavailable' on a network error, without retrying", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(analyzeImage("https://cdn.example.com/dog.jpg")).resolves.toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("returns 'unavailable' on a timeout", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

    await expect(analyzeImage("https://cdn.example.com/dog.jpg")).resolves.toBe("unavailable");
  });

  test.each([500, 503, 401, 422])("returns 'unavailable' when the AI service answers %i", async (status) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(jsonResponse(status, { detail: "error" }));

    await expect(analyzeImage("https://cdn.example.com/dog.jpg")).resolves.toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("returns 'unavailable' when the response body is malformed", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(jsonResponse(200, { unexpected: "shape" }));

    await expect(analyzeImage("https://cdn.example.com/dog.jpg")).resolves.toBe("unavailable");
  });
});
