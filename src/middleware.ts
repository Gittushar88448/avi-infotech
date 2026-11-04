import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const home = session?.role === "ADMIN" ? "/admin" : "/tech";

  if ((pathname === "/login" || pathname === "/signup") && session) return NextResponse.redirect(new URL(home, req.url));

  const needs = pathname.startsWith("/admin") ? "ADMIN" : pathname.startsWith("/tech") ? "TECHNICIAN" : null;
  if (needs) {
    if (!session) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (session.role !== needs) return NextResponse.redirect(new URL(home, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/tech/:path*", "/login", "/signup"] };
