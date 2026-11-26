import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertDemoSeedAllowed,
  checkDemoScores,
  DEMO_ASSETS_DIR,
  loadDemoAssets,
  uploadDemoAssets,
  waitForReportStatus,
} from "../../src/scripts/demo-seed";

const VALID_PASSWORD = "Demo-Clave-2026";
const THRESHOLDS = { matchThreshold: 0.45, notifyThreshold: 0.63 };

function writeAssetsDir(files: Record<string, Buffer>, manifestOverride?: object): string {
  const dir = mkdtempSync(path.join(tmpdir(), "demo-assets-"));
  const images = Object.entries(files).map(([file, body]) => {
    writeFileSync(path.join(dir, file), body);
    return {
      file,
      subject: file,
      author: "Autor",
      source: `https://commons.wikimedia.org/wiki/File:${file}`,
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      sha256: createHash("sha256").update(body).digest("hex"),
    };
  });
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifestOverride ?? { images }));
  return dir;
}

describe("assertDemoSeedAllowed", () => {
  it("rechaza NODE_ENV=production", () => {
    expect(() => assertDemoSeedAllowed({ NODE_ENV: "production", SEED_DEMO_PASSWORD: VALID_PASSWORD })).toThrow(
      /production/
    );
  });

  it("exige SEED_DEMO_PASSWORD, sin valor por defecto", () => {
    expect(() => assertDemoSeedAllowed({ NODE_ENV: "development" })).toThrow(/SEED_DEMO_PASSWORD/);
    expect(() => assertDemoSeedAllowed({ SEED_DEMO_PASSWORD: "   " })).toThrow(/SEED_DEMO_PASSWORD/);
  });

  it("exige la misma regla de contraseña que el registro", () => {
    expect(() => assertDemoSeedAllowed({ SEED_DEMO_PASSWORD: "corta1A" })).toThrow(/SEED_DEMO_PASSWORD/);
    expect(() => assertDemoSeedAllowed({ SEED_DEMO_PASSWORD: "sinnumeros" })).toThrow(/SEED_DEMO_PASSWORD/);
  });

  it("devuelve la contraseña cuando el entorno es válido", () => {
    expect(assertDemoSeedAllowed({ NODE_ENV: "development", SEED_DEMO_PASSWORD: VALID_PASSWORD })).toBe(VALID_PASSWORD);
  });
});

describe("loadDemoAssets", () => {
  it("carga el dataset versionado: cada imagen tiene licencia y el sha256 coincide", () => {
    const assets = loadDemoAssets(DEMO_ASSETS_DIR);
    const manifest = JSON.parse(readFileSync(path.join(DEMO_ASSETS_DIR, "manifest.json"), "utf8")) as {
      images: { file: string; license: string }[];
    };

    expect(assets.size).toBe(manifest.images.length);
    for (const image of manifest.images) {
      expect(["Public domain", "CC0 1.0"]).toContain(image.license);
      expect(assets.get(image.file)?.body.length).toBeGreaterThan(0);
    }
  });

  it("falla si un archivo no coincide con el sha256 del manifiesto", () => {
    const dir = writeAssetsDir({ "a.jpg": Buffer.from("original") });
    writeFileSync(path.join(dir, "a.jpg"), Buffer.from("modificado"));

    expect(() => loadDemoAssets(dir)).toThrow(/a\.jpg/);
  });

  it("falla si una imagen no tiene licencia registrada", () => {
    const body = Buffer.from("foto");
    const dir = writeAssetsDir(
      { "b.jpg": body },
      { images: [{ file: "b.jpg", sha256: createHash("sha256").update(body).digest("hex"), source: "x" }] }
    );

    expect(() => loadDemoAssets(dir)).toThrow(/licencia/);
  });
});

describe("uploadDemoAssets", () => {
  const body = Buffer.from("foto");
  const sha256 = createHash("sha256").update(body).digest("hex");
  const assets = new Map([["toby.jpg", { file: "toby.jpg", body, sha256 }]]);

  it("sube con clave por contenido y devuelve la URL pública", async () => {
    const storage = {
      getObjectMetadata: jest.fn().mockResolvedValue(null),
      uploadBuffer: jest.fn().mockResolvedValue(`https://pub.r2.dev/demo/${sha256}.jpg`),
      publicObjectUrl: jest.fn(),
    };

    const urls = await uploadDemoAssets(assets, storage);

    expect(storage.uploadBuffer).toHaveBeenCalledWith(`demo/${sha256}.jpg`, body, "image/jpeg");
    expect(urls.get("toby.jpg")).toBe(`https://pub.r2.dev/demo/${sha256}.jpg`);
  });

  it("reutiliza el objeto si ya existe en R2", async () => {
    const storage = {
      getObjectMetadata: jest.fn().mockResolvedValue({}),
      uploadBuffer: jest.fn(),
      publicObjectUrl: jest.fn().mockReturnValue(`https://pub.r2.dev/demo/${sha256}.jpg`),
    };

    const urls = await uploadDemoAssets(assets, storage);

    expect(storage.uploadBuffer).not.toHaveBeenCalled();
    expect(urls.get("toby.jpg")).toBe(`https://pub.r2.dev/demo/${sha256}.jpg`);
  });
});

describe("waitForReportStatus", () => {
  it("devuelve el estado apenas deja de estar pending", async () => {
    const read = jest.fn().mockResolvedValueOnce("pending").mockResolvedValueOnce("published");

    await expect(waitForReportStatus(read, { timeoutMs: 1_000, intervalMs: 1 })).resolves.toBe("published");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("falla si sigue pending al vencer el plazo", async () => {
    const read = jest.fn().mockResolvedValue("pending");

    await expect(waitForReportStatus(read, { timeoutMs: 20, intervalMs: 5 })).rejects.toThrow(/pending/);
  });

  it("falla si el reporte no existe", async () => {
    await expect(waitForReportStatus(async () => null, { timeoutMs: 20, intervalMs: 5 })).rejects.toThrow(
      /no existe/
    );
  });
});

describe("checkDemoScores", () => {
  it("acepta un par que notifica y un negativo sin coincidencia", () => {
    expect(checkDemoScores({ pair: 0.69, negative: -0.06, negativeMatched: false }, THRESHOLDS)).toEqual([]);
  });

  it("reporta un par sin coincidencia guardada", () => {
    expect(checkDemoScores({ pair: null, negative: 0.1, negativeMatched: false }, THRESHOLDS)).toEqual([
      expect.stringMatching(/par/),
    ]);
  });

  it("reporta un par por debajo del umbral de notificación", () => {
    expect(checkDemoScores({ pair: 0.6, negative: 0.1, negativeMatched: false }, THRESHOLDS)).toEqual([
      expect.stringMatching(/0\.63/),
    ]);
  });

  it("reporta un negativo que alcanza el umbral o que generó coincidencia", () => {
    expect(checkDemoScores({ pair: 0.7, negative: 0.45, negativeMatched: false }, THRESHOLDS)).toEqual([
      expect.stringMatching(/0\.45/),
    ]);
    expect(checkDemoScores({ pair: 0.7, negative: 0.1, negativeMatched: true }, THRESHOLDS)).toEqual([
      expect.stringMatching(/negativo/),
    ]);
  });
});
