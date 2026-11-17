import type { Location } from "react-router-dom";

// destino al que vuelve el login: viaja en state.from (#187)
export type RedirectFrom = Pick<Location, "pathname" | "search" | "hash">;

const AUTH_FORM_PATHS = ["/login", "/login/", "/register", "/register/"];

export function toRedirectFrom({ pathname, search, hash }: RedirectFrom): { from: RedirectFrom } {
  return { from: { pathname, search, hash } };
}

// solo rutas internas: evita redirecciones abiertas
export function getSafeRedirect(state: unknown): string | null {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from !== "object" || from === null) return null;

  const { pathname, search = "", hash = "" } = from as Partial<Record<keyof RedirectFrom, unknown>>;
  if (typeof pathname !== "string" || typeof search !== "string" || typeof hash !== "string") return null;
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("\\")) return null;
  if (search !== "" && !search.startsWith("?")) return null;
  if (hash !== "" && !hash.startsWith("#")) return null;
  if (AUTH_FORM_PATHS.includes(pathname)) return null;

  return `${pathname}${search}${hash}`;
}

export function postLoginPath(state: unknown): string {
  return getSafeRedirect(state) ?? "/";
}
