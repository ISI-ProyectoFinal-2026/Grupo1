import express from "express";
import request from "supertest";
import { applyTrustProxy, parseTrustProxy } from "../../src/config/trust-proxy";

// App mínima que devuelve req.ip: es lo que usa express-rate-limit como key
// por defecto, así que es exactamente lo que hay que verificar.
function buildIpEchoApp(rawTrustProxy: string | undefined) {
  const app = express();
  applyTrustProxy(app, rawTrustProxy);
  app.get("/ip", (req, res) => {
    res.json({ ip: req.ip });
  });
  return app;
}

describe("parseTrustProxy", () => {
  test.each([
    ["sin definir", undefined],
    ["vacío", ""],
    ["solo espacios", "   "],
    ["\"false\"", "false"],
  ])("%s ⇒ no se confía en el proxy", (_label, raw) => {
    expect(parseTrustProxy(raw)).toBe(false);
  });

  test.each([
    ["0", 0],
    ["1", 1],
    [" 2 ", 2],
  ])("\"%s\" ⇒ cantidad de saltos %i", (raw, expected) => {
    expect(parseTrustProxy(raw)).toBe(expected);
  });

  test.each(["true", "TRUE", "-1", "1.5", "loopback", "10.0.0.1", "abc"])(
    "rechaza \"%s\" con un error que nombra la variable",
    (raw) => {
      expect(() => parseTrustProxy(raw)).toThrow(/TRUST_PROXY/);
    }
  );
});

describe("applyTrustProxy", () => {
  test("con TRUST_PROXY=1, req.ip sale del último salto de X-Forwarded-For", async () => {
    const res = await request(buildIpEchoApp("1"))
      .get("/ip")
      .set("X-Forwarded-For", "203.0.113.7");

    expect(res.body.ip).toBe("203.0.113.7");
  });

  test("con TRUST_PROXY=1, un X-Forwarded-For falsificado por el cliente no se usa", async () => {
    // El cliente manda su propio XFF y el proxy de confianza le agrega la IP
    // real al final: con 1 salto solo se toma esa última.
    const res = await request(buildIpEchoApp("1"))
      .get("/ip")
      .set("X-Forwarded-For", "1.2.3.4, 203.0.113.7");

    expect(res.body.ip).toBe("203.0.113.7");
  });

  test("sin TRUST_PROXY, X-Forwarded-For se ignora y req.ip es la IP del socket", async () => {
    const res = await request(buildIpEchoApp(undefined))
      .get("/ip")
      .set("X-Forwarded-For", "203.0.113.7");

    expect(res.body.ip).not.toBe("203.0.113.7");
    expect(res.body.ip).toMatch(/127\.0\.0\.1|::1/);
  });
});

describe("src/app.ts toma TRUST_PROXY del entorno", () => {
  const originalTrustProxy = process.env.TRUST_PROXY;

  afterEach(() => {
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalTrustProxy;
  });

  function loadApp(): express.Express {
    let loaded: express.Express | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      loaded = require("../../src/app").app;
    });
    return loaded!;
  }

  test("TRUST_PROXY=1 ⇒ app confía en 1 salto", () => {
    process.env.TRUST_PROXY = "1";
    expect(loadApp().get("trust proxy")).toBe(1);
  });

  test("sin TRUST_PROXY ⇒ app no confía en ningún proxy", () => {
    delete process.env.TRUST_PROXY;
    expect(loadApp().get("trust proxy")).toBe(false);
  });

  test("TRUST_PROXY=true ⇒ el server no arranca", () => {
    process.env.TRUST_PROXY = "true";
    expect(() => loadApp()).toThrow(/TRUST_PROXY/);
  });
});
