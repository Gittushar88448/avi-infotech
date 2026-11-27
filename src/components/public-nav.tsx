import Link from "next/link";
import { Logo } from "./ui";
import { ThemeToggle } from "./theme-toggle";
import { getSession } from "@/lib/auth";
import { LayoutDashboard } from "lucide-react";

/** Where a signed-in user's dashboard is. */
export const homeFor = (role: string) => (role === "ADMIN" ? "/admin" : "/tech");

export async function PublicNav() {
  // Signed in: show only Dashboard. Signed out: Sign up and Sign in.
  const session = await getSession().catch(() => null);
  return (
    <header className="public-nav">
      <div className="container">
        <Link href="/"><Logo /></Link>
        <nav className="row" style={{ "--gap": "6px" } as React.CSSProperties}>
          <Link href="/reviews" className="btn btn-ghost btn-sm">Reviews</Link>
          <ThemeToggle />
          {session ? (
            <Link href={homeFor(session.role)} className="btn btn-primary btn-sm"><LayoutDashboard /> Dashboard</Link>
          ) : (
            <>
              <Link href="/signup" className="btn btn-ghost btn-sm hide-sm-inline">Sign up</Link>
              <Link href="/login" className="btn btn-primary btn-sm">Sign in</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="container row between wrap muted" style={{ padding: "40px 20px", fontSize: 13, borderTop: "1px solid var(--border)", marginTop: 60 }}>
      <span>© {new Date().getFullYear()} {process.env.APP_NAME || "Avi Infotech"}</span>
      <Link href="/reviews" className="link-underline">Customer reviews</Link>
    </footer>
  );
}
