import type { Express } from "express";

/**
 * Interpreta TRUST_PROXY: cuántos proxies de confianza hay delante del
 * backend (Vite dev/preview, un túnel, el load balancer del hosting...).
 *
 * Sin esto, detrás de un proxy `req.ip` es siempre la IP del proxy, y todos
 * los rate limiters (auth, uploads, flyer) comparten UN contador global: un
 * solo usuario agota el cupo de todos.
 *
 * - sin definir, vacío o "false" ⇒ no se confía en ningún proxy (default de
 *   Express): `req.ip` es la IP del socket.
 * - entero >= 0 ⇒ cantidad de saltos de X-Forwarded-For en los que se confía,
 *   contando desde el final (el proxy más cercano al backend).
 *
 * A propósito NO se acepta "true": confiar en todos los saltos hace que
 * `req.ip` sea el primer valor de X-Forwarded-For, que lo manda el cliente y
 * se puede falsificar libremente. Con eso, cualquiera evade los rate limiters
 * mandando una IP distinta en cada request.
 */
export function parseTrustProxy(raw: string | undefined): number | false {
  const value = raw?.trim() ?? "";
  if (value === "" || value.toLowerCase() === "false") {
    return false;
  }
  if (/^\d+$/.test(value)) {
    return Number(value);
  }
  throw new Error(
    `TRUST_PROXY inválida ("${value}"): usá la cantidad de proxies delante del backend (ej. 1) o dejala vacía. ` +
      '"true" no se acepta porque confiaría en un X-Forwarded-For que el cliente puede falsificar.'
  );
}

export function applyTrustProxy(app: Express, raw: string | undefined): void {
  const hops = parseTrustProxy(raw);
  if (hops !== false) {
    app.set("trust proxy", hops);
  }
}
