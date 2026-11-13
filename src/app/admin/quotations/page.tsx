import Link from "next/link";
import { ChevronRight, FileSignature, Plus, Search } from "lucide-react";
import { QUOTE_STATUSES, type QuoteStatus } from "@/lib/store/models";
import { listQuotes, quoteSummary } from "@/lib/store/quotes";
import { formatINR, formatINRShort, quoteCode } from "@/lib/store/money";
import { fmtDate } from "@/lib/format";
import { CountUp, HoverLetters } from "@/components/fancy-text";
import { QUOTE_STATUS_LABEL, QuoteStatusBadge } from "./status";
import { LiveFilter } from "@/components/live-filter";

export const metadata = { title: "Quotations" };
export const dynamic = "force-dynamic";

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = (QUOTE_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as QuoteStatus) : undefined;
  const [quotes, summary] = await Promise.all([listQuotes({ q, status }), quoteSummary()]);
  const by = Object.fromEntries(summary.map((s) => [s._id, s]));
  const open = (["DRAFT", "SENT", "ACCEPTED"] as const).reduce((a, k) => ({ count: a.count + (by[k]?.count ?? 0), value: a.value + (by[k]?.value ?? 0) }), { count: 0, value: 0 });
  const total = summary.reduce((a, s) => a + s.count, 0);
  const won = (by.ACCEPTED?.count ?? 0) + (by.CONVERTED?.count ?? 0);
  const decided = won + (by.REJECTED?.count ?? 0);
  const href = (st?: string) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(st && { status: st }) });
    return `/admin/quotations${p.size ? `?${p}` : ""}`;
  };
  const today = new Date();

  const stats = [
    { label: "Quotations", value: <CountUp value={total} />, c: "var(--sky)", sc: "var(--sky-soft)" },
    { label: "Open value", value: formatINRShort(open.value), sub: `${open.count} draft, sent or accepted`, c: "var(--indigo)", sc: "var(--indigo-soft)" },
    { label: "Billed", value: formatINRShort(by.CONVERTED?.value ?? 0), sub: `${by.CONVERTED?.count ?? 0} turned into bills`, c: "var(--green)", sc: "var(--green-soft)" },
    { label: "Win rate", value: decided ? `${Math.round((won / decided) * 100)}%` : "—", sub: "accepted or billed vs rejected", c: "var(--violet)", sc: "var(--violet-soft)" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <span className="eyebrow">Sales</span>
          <h1 className="page-title display"><HoverLetters text="Quotations" /></h1>
        </div>
        <Link href="/admin/quotations/new" className="btn btn-primary"><Plus /> New quotation</Link>
      </div>

      <div className="stats">
        {stats.map((x, i) => (
          <div key={x.label} className="card stat spotlight card-hover" style={{ animation: `rise .5s var(--ease) ${i * 60}ms both` }}>
            <span className="eyebrow">{x.label}</span>
            <div className="stat-icon" style={{ "--c": x.c, "--s": x.sc } as React.CSSProperties}><FileSignature /></div>
            <div className="stat-value" style={{ fontSize: 30 }}>{x.value}</div>
            {x.sub && <span className="hint">{x.sub}</span>}
          </div>
        ))}
      </div>

      <div className="row wrap between">
        <nav className="tabs" style={{ flexWrap: "wrap" }}>
          <Link href={href()} className="tab" data-active={!status}>All <small>{total}</small></Link>
          {QUOTE_STATUSES.map((s) => (
            <Link key={s} href={href(s)} className="tab" data-active={status === s}>{QUOTE_STATUS_LABEL[s]} {by[s]?.count ? <small>{by[s].count}</small> : null}</Link>
          ))}
        </nav>
        <LiveFilter className="row" style={{ "--gap": "8px" } as React.CSSProperties}>
          {status && <input type="hidden" name="status" value={status} />}
          <div className="input-wrap" style={{ width: "min(320px, 100%)" }}>
            <Search className="icon-left" />
            <input name="q" defaultValue={q} className="input" type="search" placeholder="Customer, phone, product or QT no." style={{ height: 42 }} />
          </div>
        </LiveFilter>
      </div>

      {quotes.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon"><FileSignature /></div>
          <strong style={{ color: "var(--text)" }}>{q || status ? "No quotations match" : "No quotations yet"}</strong>
          <span>Make one in a minute: scan or pick products, and the total is worked out as you go.</span>
          {!q && !status && <Link href="/admin/quotations/new" className="btn btn-primary" style={{ marginTop: 10 }}><Plus /> New quotation</Link>}
        </div>
      ) : (
        <div className="list table-wrap">
          <table className="table table-rows">
            <thead><tr><th>Quotation</th><th>Customer</th><th className="hide-sm">Items</th><th className="num">Total</th><th>Status</th><th /></tr></thead>
            <tbody>
              {quotes.map((x) => {
                const expired = x.validUntil && x.status !== "CONVERTED" && x.status !== "REJECTED" && new Date(x.validUntil) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                return (
                  <tr key={String(x._id)}>
                    <td>
                      <Link href={`/admin/quotations/${x._id}`} className="stack" style={{ "--gap": "2px" } as React.CSSProperties}>
                        <span className="row-title mono">{quoteCode(x.number)}</span>
                        <span className="row-sub">{fmtDate(x.createdAt)}{x.subject && ` · ${x.subject}`}</span>
                      </Link>
                    </td>
                    <td>{x.customerSnapshot?.name}<div className="row-sub mono">{x.customerSnapshot?.phone}</div></td>
                    <td className="hide-sm text-2">{x.items.length} line{x.items.length > 1 ? "s" : ""}</td>
                    <td className="num" style={{ fontWeight: 750 }}>{formatINR(x.grandTotal)}</td>
                    <td><div className="row" style={{ "--gap": "6px" } as React.CSSProperties}><QuoteStatusBadge status={x.status} />{expired && <span className="badge badge-REJECTED">Expired</span>}</div></td>
                    <td><Link href={`/admin/quotations/${x._id}`} className="icon-btn" aria-label="Open"><ChevronRight /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
