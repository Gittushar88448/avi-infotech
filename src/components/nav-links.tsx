"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Grid2x2, X, ClipboardList, Contact, FileSignature, FileStack, LayoutDashboard, MapPinned, MessageSquareText, Package, PlusCircle, ReceiptText, Settings2, ScanBarcode, Send, Star, Users, Wrench } from "lucide-react";

const ICONS = { dashboard: LayoutDashboard, new: PlusCircle, team: Users, reviews: Star, sms: Send, jobs: Wrench, history: ClipboardList, public: MessageSquareText, billing: ScanBarcode, products: Package, sales: ReceiptText, customers: Contact, map: MapPinned, settings: Settings2, purchases: FileStack, quotes: FileSignature };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean; count?: number };

export function NavLinks({ items, mobile }: { items: NavItem[]; mobile?: boolean }) {
  const path = usePathname();
  const active = (i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/"));
  if (mobile) return <MobileNav items={items} active={active} path={path} />;
  return (
    <nav className="stack" style={{ "--gap": "4px" } as React.CSSProperties}>
      {items.map((i) => {
        const Icon = ICONS[i.icon];
        return (
          <Link key={i.href} href={i.href} className="nav-link" data-active={active(i)}>
            <Icon />
            {i.label}
            {!!i.count && <span className="nav-count">{i.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Phone bottom bar. Up to 5 items fit; with more, the first 4 show and a "More" button opens a
 * panel with every other page, so all features are reachable on a phone.
 */
function MobileNav({ items, active, path }: { items: NavItem[]; active: (i: NavItem) => boolean; path: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const many = items.length > 5;
  const bar = many ? items.slice(0, 4) : items;
  const rest = many ? items.slice(4) : [];
  const restActive = rest.some(active);
  const restCount = rest.reduce((n, i) => n + (i.count ?? 0), 0);
  return (
    <>
      {open && (
        <div className="mobile-more-backdrop" onClick={() => setOpen(false)}>
          <div className="mobile-more" role="dialog" aria-label="All pages" onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <strong>All pages</strong>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}><X /></button>
            </div>
            <div className="mobile-more-grid">
              {rest.map((i) => {
                const Icon = ICONS[i.icon];
                return (
                  <Link key={i.href} href={i.href} data-active={active(i)} onClick={() => setOpen(false)}>
                    <Icon />
                    <span>{i.label}</span>
                    {!!i.count && <span className="nav-count">{i.count}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <nav className="mobile-nav">
        {bar.map((i) => {
          const Icon = ICONS[i.icon];
          return (
            <Link key={i.href} href={i.href} data-active={active(i)}>
              <span className="mobile-nav-icon"><Icon />{!!i.count && <span className="mobile-nav-dot">{i.count}</span>}</span>
              {i.label}
            </Link>
          );
        })}
        {many && (
          <button type="button" data-active={restActive || open} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <span className="mobile-nav-icon"><Grid2x2 />{restCount > 0 && <span className="mobile-nav-dot">{restCount}</span>}</span>
            More
          </button>
        )}
      </nav>
    </>
  );
}
