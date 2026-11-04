import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { User, isId } from "./db";
import { SESSION_COOKIE, signSession, verifySession, type Role, type SessionClaims } from "./session-token";

export type Session = SessionClaims;

export async function createSession(user: { _id: unknown; role: string; name: string; sessionVersion: number }) {
  const token = await signSession({ uid: String(user._id), role: user.role as Role, name: user.name, v: user.sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https"),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Verifies the cookie and checks the user still exists, is active and hasn't reset their password since. */
export async function getSession(): Promise<Session | null> {
  const claims = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  if (!isId(claims.uid)) return null;
  const user = await User.findById(claims.uid).select("active sessionVersion role name").lean();
  if (!user || !user.active || user.sessionVersion !== claims.v) return null;
  return { ...claims, role: user.role as Role, name: user.name };
}

export async function requireRole(role: Role): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/api/auth/signout");
  if (s.role !== role) redirect(s.role === "ADMIN" ? "/admin" : "/tech");
  return s;
}

/** For route handlers: returns the session or null when the role doesn't match. */
export async function apiSession(role?: Role): Promise<Session | null> {
  const s = await getSession();
  if (!s || (role && s.role !== role)) return null;
  return s;
}
