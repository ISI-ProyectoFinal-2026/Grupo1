import { isR2PublicUrl } from "../../src/services/storage.service";

describe("storage.service isR2PublicUrl", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test.each([
    ["https://pub-test.r2.dev/pets/abc.jpg", true],
    ["https://pub-test.r2.dev/", true],
    ["http://pub-test.r2.dev/pets/abc.jpg", false],
    ["https://pub-test.r2.dev.evil.com/pets/abc.jpg", false],
    ["https://evil.com/?u=https://pub-test.r2.dev/x.jpg", false],
    ["http://169.254.169.254/latest/meta-data", false],
    ["http://localhost:8000/health", false],
    ["not a url", false],
  ])("with R2_PUBLIC_URL=https://pub-test.r2.dev, %s -> %s", (url, expected) => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";

    expect(isR2PublicUrl(url)).toBe(expected);
  });

  test("honors a path prefix in R2_PUBLIC_URL", () => {
    process.env.R2_PUBLIC_URL = "https://cdn.example.com/bucket/";

    expect(isR2PublicUrl("https://cdn.example.com/bucket/pets/a.jpg")).toBe(true);
    expect(isR2PublicUrl("https://cdn.example.com/other/pets/a.jpg")).toBe(false);
    expect(isR2PublicUrl("https://cdn.example.com/bucket-evil/a.jpg")).toBe(false);
  });

  test("rejects everything when R2_PUBLIC_URL is not configured", () => {
    delete process.env.R2_PUBLIC_URL;

    expect(isR2PublicUrl("https://pub-test.r2.dev/pets/abc.jpg")).toBe(false);
  });
});
