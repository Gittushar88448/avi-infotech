import Link from "next/link";
import { LogOut } from "lucide-react";
import { Avatar, Logo } from "./ui";
import { ThemeToggle } from "./theme-toggle";
import { LiveBell } from "./live";
import { NavLinks, type NavItem } from "./nav-links";
import type { Session } from "@/lib/auth";

export function AppShell({ session, nav, topbar, children }: { session: Session; nav: NavItem[]; topbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="shell">
      <div className="aurora" />
      <aside className="sidebar">
        <Link href={session.role === "ADMIN" ? "/admin" : "/tech"} className="brand"><Logo /></Link>
        <NavLinks items={nav} />
        <div className="sidebar-foot">
          <div className="row" style={{ padding: "4px 8px" }}>
            <Avatar name={session.name} size={36} />
            <div className="grow">
              <div style={{ fontWeight: 750, fontSize: 14 }}>{session.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{session.role === "ADMIN" ? "Administrator" : "Technician"}</div>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="nav-link" style={{ width: "100%", border: 0, background: "none", cursor: "pointer" }}>
              <LogOut /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="grow" />
          {topbar}
          <LiveBell />
          <ThemeToggle />
          <form action="/api/auth/signout" method="post" className="hide-desktop">
            <button className="icon-btn" aria-label="Sign out" title="Sign out"><LogOut /></button>
          </form>
        </header>
        {children}
      </div>
      <NavLinks items={nav} mobile />
    </div>
  );
}
