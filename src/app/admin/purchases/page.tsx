import Link from "next/link";
import { ChevronRight, FileStack, Paperclip, Search } from "lucide-react";
import { listPurchaseBills } from "@/lib/store/purchase-bills";
import { parsePurchaseType } from "@/lib/store/bill-format";
import { formatINR } from "@/lib/store/money";
import { HoverLetters } from "@/components/fancy-text";
import { PurchaseBadge } from "@/components/store-ui";
import { NewPurchaseBill } from "./purchases-client";
import { LiveFilter } from "@/components/live-filter";

export const metadata = { title: "Purchase bills" };
export const dynamic = "force-dynamic";

const TYPES = [
  { v: "", l: "All bills" },
  { v: "LOCAL", l: "Without GST" },
  { v: "GST", l: "GST" },
] as const;

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const t = parsePurchaseType(sp.type);
  const type = t === "GST" || t === "LOCAL" ? t : "";
  const bills = await listPurchaseBills({ q, type: type || undefined });
  const total = bills.reduce((a, b) => a + b.amount, 0);
  const href = (v: string) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(v && { type: v }) });
    return `/admin/purchases${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <span className="eyebrow">Inventory</span>
          <h1 className="page-title display"><HoverLetters text="Purchase bills" /></h1>
          <span className="text-2">Every supplier bill for stock you bought, GST or Without GST, with a photo or PDF of the paper bill.</span>
        </div>
        <NewPurchaseBill />
      </div>

      <div className="row wrap between">
        <nav className="tabs" aria-label="Bill type">
          {TYPES.map((f) => <Link key={f.v} href={href(f.v)} className="tab" data-active={type === f.v}>{f.l}</Link>)}
        </nav>
        <LiveFilter className="row wrap" style={{ "--gap": "8px" } as React.CSSProperties}>
          {type && <input type="hidden" name="type" value={type} />}
          <div className="input-wrap" style={{ width: "min(300px, 100%)" }}>
            <Search className="icon-left" />
            <input name="q" defaultValue={q} className="input" type="search" placeholder="Supplier or bill no." style={{ height: 42 }} />
          </div>
        </LiveFilter>
      </div>

      {bills.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon"><FileStack /></div>
          <strong style={{ color: "var(--text)" }}>{q || type ? "No bills match" : "No purchase bills yet"}</strong>
          <span>Add one here, or when you add a product or restock it.</span>
        </div>
      ) : (
        <div className="list table-wrap">
          <table className="table table-rows">
            <thead>
              <tr><th>Bill</th><th>Type</th><th className="hide-sm">Products</th><th className="num">Total</th><th className="hide-sm">Files</th><th /></tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/admin/purchases/${b.id}`} className="stack" style={{ "--gap": "2px" } as React.CSSProperties}>
                      <span className="row-title">{b.supplier || "Supplier not entered"}</span>
                      <span className="row-sub">{[b.billNo && `Bill ${b.billNo}`, b.billDate && new Date(b.billDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })].filter(Boolean).join(" · ") || "No bill number"}</span>
                    </Link>
                  </td>
                  <td><PurchaseBadge type={b.billType} /></td>
                  <td className="hide-sm text-2">{b.lines ? `${b.lines} line${b.lines > 1 ? "s" : ""} · ${b.units} units` : "—"}</td>
                  <td className="num">{b.amount ? formatINR(b.amount) : "—"}</td>
                  <td className="hide-sm">{b.files.length ? <span className="row" style={{ "--gap": "4px" } as React.CSSProperties}><Paperclip style={{ width: 15 }} />{b.files.length}</span> : <span className="muted">none</span>}</td>
                  <td><Link href={`/admin/purchases/${b.id}`} className="icon-btn" aria-label="Open"><ChevronRight /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > 0 && <span className="hint" style={{ textAlign: "right" }}>Total of bills shown: <b>{formatINR(total)}</b></span>}
    </div>
  );
}
