import { z } from "zod";
import { sendMessageSchema } from "../../src/validators/chat-socket.validator";
import { sendMessageBodySchema } from "../../src/validators/chats.validator";
import { createPetSchema, updatePetSchema } from "../../src/validators/pets.validator";
import { createReportSchema, setCustomFlyerSchema, updateReportSchema } from "../../src/validators/reports.validator";
import { r2ImageUrlSchema } from "../../src/validators/shared.validator";
import { analyzeImageSchema } from "../../src/validators/uploads.validator";

const R2_MESSAGE = "La imagen debe haber sido subida a PATITAS";
const IN_BUCKET = "https://pub-test.r2.dev/pets/dog.jpg";
const OUTSIDE_BUCKET = [
  "http://169.254.169.254/latest/meta-data/",
  "http://localhost:8000/health",
  "https://pub-test.r2.dev.evil.com/pets/dog.jpg",
  "https://evil.com/dog.jpg",
];

const baseReport = { reportType: "lost", title: "Perro perdido", location: { lat: -34.6, lng: -58.38 } };

// cada punto de entrada con la URL en su campo
const entryPoints: Array<[string, z.ZodType, (url: string) => unknown, string]> = [
  ["createReportSchema.imageUrl", createReportSchema, (url) => ({ ...baseReport, imageUrl: url }), "imageUrl"],
  ["updateReportSchema.imageUrl", updateReportSchema, (url) => ({ imageUrl: url }), "imageUrl"],
  ["setCustomFlyerSchema.flyerUrl", setCustomFlyerSchema, (url) => ({ flyerUrl: url }), "flyerUrl"],
  ["sendMessageSchema.imageUrl (socket)", sendMessageSchema, (url) => ({ chatId: 1, imageUrl: url }), "imageUrl"],
  ["sendMessageBodySchema.imageUrl (REST)", sendMessageBodySchema, (url) => ({ imageUrl: url }), "imageUrl"],
  ["analyzeImageSchema.imageUrl", analyzeImageSchema, (url) => ({ imageUrl: url }), "imageUrl"],
];

// S9: entradas que otro parser (httpx) puede leer con otro host
const PARSER_DIFFERENTIAL = [
  ["backslash before @", "https://pub-test.r2.dev\\@evil.com/a.jpg"],
  ["username", "https://evil.com@pub-test.r2.dev/a.jpg"],
  ["username and password", "https://user:pass@pub-test.r2.dev/a.jpg"],
  ["space", "https://pub-test.r2.dev/a b.jpg"],
  ["leading space", " https://pub-test.r2.dev/a.jpg"],
  ["tab", "https://pub-test.r2.dev/a\t.jpg"],
  ["newline", "https://pub-test.r2.dev/a\n.jpg"],
  ["NUL", "https://pub-test.r2.dev/a\u0000.jpg"],
  ["DEL", "https://pub-test.r2.dev/a\u007f.jpg"],
];
const NOT_NORMALIZED = "HTTPS://PUB-TEST.r2.dev/a.jpg";
const NORMALIZED = "https://pub-test.r2.dev/a.jpg";

function issueMessages(result: { success: boolean; error?: z.ZodError }): string[] {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("image URL validation restricted to the R2 bucket", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("r2ImageUrlSchema", () => {
    test("accepts a URL inside the bucket", () => {
      expect(r2ImageUrlSchema.safeParse(IN_BUCKET).success).toBe(true);
    });

    test.each(OUTSIDE_BUCKET)("rejects %s with the PATITAS message", (url) => {
      const result = r2ImageUrlSchema.safeParse(url);

      expect(result.success).toBe(false);
      expect(issueMessages(result)).toEqual([R2_MESSAGE]);
    });

    test("keeps rejecting non-http(s) schemes", () => {
      expect(r2ImageUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
    });

    test.each(PARSER_DIFFERENTIAL)("rejects a URL with %s", (_label, url) => {
      const result = r2ImageUrlSchema.safeParse(url);

      expect(result.success).toBe(false);
      expect(issueMessages(result)).toEqual([R2_MESSAGE]);
    });

    test("outputs the normalized href", () => {
      expect(r2ImageUrlSchema.parse(NOT_NORMALIZED)).toBe(NORMALIZED);
    });
  });

  describe.each(entryPoints)("%s parser-differential hardening (S9)", (_label, schema, build, field) => {
    test.each(PARSER_DIFFERENTIAL)("rejects a URL with %s", (_case, url) => {
      const result = schema.safeParse(build(url));

      expect(result.success).toBe(false);
      expect(issueMessages(result)).toContain(R2_MESSAGE);
    });

    test("outputs the normalized href", () => {
      const result = schema.safeParse(build(NOT_NORMALIZED));

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>)[field]).toBe(NORMALIZED);
    });
  });

  describe.each(entryPoints)("%s", (_label, schema, build) => {
    test("accepts a URL inside the bucket", () => {
      expect(schema.safeParse(build(IN_BUCKET)).success).toBe(true);
    });

    test.each(OUTSIDE_BUCKET)("rejects %s with the PATITAS message", (url) => {
      const result = schema.safeParse(build(url));

      expect(result.success).toBe(false);
      expect(issueMessages(result)).toContain(R2_MESSAGE);
    });

    test("rejects even an in-bucket URL when R2_PUBLIC_URL is not set", () => {
      delete process.env.R2_PUBLIC_URL;

      const result = schema.safeParse(build(IN_BUCKET));

      expect(result.success).toBe(false);
      expect(issueMessages(result)).toContain(R2_MESSAGE);
    });
  });

  // S11: cada foto de la mascota
  describe.each([
    ["createPetSchema.photoUrls", createPetSchema],
    ["updatePetSchema.photoUrls", updatePetSchema],
  ] as Array<[string, z.ZodType]>)("%s", (_label, schema) => {
    const basePet = { name: "Rocky", breed: "Labrador", age: 3, color: "Marrón", description: "Mascota" };

    test("accepts in-bucket photos and outputs them normalized", () => {
      const result = schema.safeParse({ ...basePet, photoUrls: [IN_BUCKET, NOT_NORMALIZED] });

      expect(result.success).toBe(true);
      expect((result.data as { photoUrls: string[] }).photoUrls).toEqual([IN_BUCKET, NORMALIZED]);
    });

    test.each([...OUTSIDE_BUCKET, "https://pub-test.r2.dev\\@evil.com/a.jpg", "https://evil.com@pub-test.r2.dev/a.jpg"])(
      "rejects a photo list containing %s",
      (url) => {
        const result = schema.safeParse({ ...basePet, photoUrls: [IN_BUCKET, url] });

        expect(result.success).toBe(false);
        expect(issueMessages(result)).toContain(R2_MESSAGE);
      }
    );
  });
});
