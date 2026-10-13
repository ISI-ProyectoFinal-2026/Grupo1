import jwt from "jsonwebtoken";

export interface AccessTokenPayload {
  sub: number;
  email: string;
  // Versión de sesión del usuario al emitir el token. Los tokens emitidos antes
  // de que existiera no la traen: se interpretan como versión 0.
  tv?: number;
}

export function signAccessToken(user: { id: number; email: string; tokenVersion: number }): string {
  return jwt.sign({ sub: user.id, email: user.email, tv: user.tokenVersion }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRY || "24h",
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as unknown as AccessTokenPayload;
}
