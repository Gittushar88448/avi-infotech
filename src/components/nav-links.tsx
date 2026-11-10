"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Contact, FileSignature, FileStack, LayoutDashboard, MapPinned, MessageSquareText, Package, PlusCircle, ReceiptText, Settings2, ScanBarcode, Send, Star, Users, Wrench } from "lucide-react";

const ICONS = { dashboard: LayoutDashboard, new: PlusCircle, team: Users, reviews: Star, sms: Send, jobs: Wrench, history: ClipboardList, public: MessageSquareText, billing: ScanBarcode, products: Package, sales: ReceiptText, customers: Contact, map: MapPinned, settings: Settings2, purchases: FileStack, quotes: FileSignature };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean; count?: number };

export function NavLinks({ items, mobile }: { items: NavItem[]; mobile?: boolean }) {
  const path = usePathname();
  const active = (i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/"));
  if (mobile) {
    return (
      <nav className="mobile-nav">
        {items.slice(0, 5).map((i) => {
          const Icon = ICONS[i.icon];
          return (
            <Link key={i.href} href={i.href} data-active={active(i)}>
              <Icon />
              {i.label}
            </Link>
          );
        })}
      </nav>
    );
  }
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
