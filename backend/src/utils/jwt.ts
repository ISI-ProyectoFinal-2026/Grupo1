import jwt from "jsonwebtoken";

export interface AccessTokenPayload {
  sub: number;
  email: string;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as unknown as AccessTokenPayload;
}
