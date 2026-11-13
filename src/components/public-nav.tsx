import Link from "next/link";
import { Logo } from "./ui";
import { ThemeToggle } from "./theme-toggle";

export function PublicNav() {
  return (
    <header className="public-nav">
      <div className="container">
        <Link href="/"><Logo /></Link>
        <nav className="row" style={{ "--gap": "6px" } as React.CSSProperties}>
          <Link href="/reviews" className="btn btn-ghost btn-sm">Reviews</Link>
          <ThemeToggle />
          {
            
          }
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
