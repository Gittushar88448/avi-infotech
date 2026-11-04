import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-token";

function signOut(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
export const GET = signOut;
export const POST = signOut;
