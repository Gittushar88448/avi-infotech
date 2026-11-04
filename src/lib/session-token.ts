// Edge-safe JWT helpers, shared by middleware and server code.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "fd_session";
export type Role = "ADMIN" | "TECHNICIAN";
export type SessionClaims = { uid: string; role: Role; name: string; v: number };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s || "dev-only-insecure-secret");
}

export async function signSession(claims: SessionClaims) {
  return new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret());
}

export async function verifySession(token?: string): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}
