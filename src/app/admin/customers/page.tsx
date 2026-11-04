import Link from "next/link";
import { ChevronRight, Contact, Search } from "lucide-react";
import { Customer } from "@/lib/store/models";
import { customerTotals } from "@/lib/store/customers";
import { formatINR } from "@/lib/store/money";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { HoverLetters } from "@/components/fancy-text";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? "";
  const digits = q.replace(/\D/g, "");
  const rx = q ? new RegExp(escapeRx(q), "i") : null;
  const customers = await Customer.find(rx ? { $or: [{ name: rx }, { email: rx }, { address: rx }, ...(digits.length >= 3 ? [{ phoneKey: new RegExp(digits) }] : [])] } : {})
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  const totals = await customerTotals(customers.map((c) => String(c._id)));

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <span className="eyebrow">Buyers</span>
          <h1 className="page-title display"><HoverLetters text="Customers" /></h1>
        </div>
        <form className="input-wrap" style={{ width: "min(340px, 100%)" }}>
          <Search className="icon-left" />
          <input name="q" defaultValue={q} className="input" placeholder="Name, phone, email or address" style={{ height: 42 }} />
        </form>
      </div>

      {customers.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon"><Contact /></div>
          <strong style={{ color: "var(--text)" }}>{q ? "No customer matches that search" : "No customers yet"}</strong>
          <span>Customers are saved automatically when you make a bill with their phone number.</span>
        </div>
      ) : (
        <div className="list">
          {customers.map((c, i) => {
            const t = totals[String(c._id)];
            return (
              <Link key={String(c._id)} href={`/admin/customers/${c._id}`} className="list-row" style={{ gridTemplateColumns: "40px minmax(0,1fr) 110px 140px 24px", "--i": Math.min(i, 12) } as React.CSSProperties}>
                <span className="hide-sm"><Avatar name={c.name} size={36} /></span>
                <div className="stack" style={{ "--gap": "2px", minWidth: 0 } as React.CSSProperties}>
                  <span className="row-title">{c.name}</span>
                  <span className="row-sub"><span className="mono">{c.phone}</span>{c.address && ` · ${c.address}`}</span>
                </div>
                <span className="hide-sm text-2" style={{ fontSize: 13.5 }}>{t ? `${t.bills} bill${t.bills === 1 ? "" : "s"}` : "No bills"}{t && <div className="muted" style={{ fontSize: 12 }}>last {timeAgo(t.last)}</div>}</span>
                <span className="display" style={{ fontSize: 18, justifySelf: "end" }}>{formatINR(t?.spent ?? 0)}</span>
                <ChevronRight className="go hide-sm" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
