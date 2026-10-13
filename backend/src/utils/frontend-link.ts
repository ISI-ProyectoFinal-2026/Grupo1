/** Link a una pantalla del frontend que recibe el token por query string. */
export function frontendLink(path: string, token: string): string {
  const base = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${base}${path}?token=${token}`;
}
