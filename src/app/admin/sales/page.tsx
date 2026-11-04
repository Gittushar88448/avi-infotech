import Link from "next/link";
import { CalendarDays, ChevronRight, IndianRupee, Plus, ReceiptText, Search, TrendingUp } from "lucide-react";
import { Sale } from "@/lib/store/models";
import { salesSummary } from "@/lib/store/sales";
import { formatINR, formatINRShort, invoiceCode } from "@/lib/store/money";
import { fmtDate } from "@/lib/format";
import { HoverLetters } from "@/components/fancy-text";
import { SaleStatus } from "@/components/store-ui";

export const metadata = { title: "Sales history" };
export const dynamic = "force-dynamic";

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const day = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : null);

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ q?: string; from?: string; to?: string; status?: string; type?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const from = day(sp.from);
  const to = day(sp.to);
  const status = sp.status === "CANCELLED" || sp.status === "CREDIT" ? sp.status : "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const month = new Date(now.getFullYear(), now.getMonth(), 1);

  const num = Number(q.replace(/^(inv|bill)-?/i, ""));
  const type = sp.type === "GST" || sp.type === "PLAIN" ? sp.type : "";
  const rx = q ? new RegExp(escapeRx(q), "i") : null;
  const filter: Record<string, unknown> = {
    ...(rx && { $or: [{ "customerSnapshot.name": rx }, { "customerSnapshot.phone": rx }, { "items.name": rx }, { "items.barcode": q }, ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : [])] }),
    ...((from || to) && { createdAt: { ...(from && { $gte: from }), ...(to && { $lt: new Date(to.getTime() + 86_400_000) }) } }),
    ...(status === "CANCELLED" && { status: "CANCELLED" }),
    ...(type === "PLAIN" && { billType: "PLAIN" }),
    ...(type === "GST" && { billType: { $ne: "PLAIN" } }),
    ...(status === "CREDIT" && { status: "PAID", paymentMode: "CREDIT" }),
  };

  const [daySum, monthSum, sales, filteredSum] = await Promise.all([
    salesSummary(today),
    salesSummary(month),
    Sale.find(filter).sort({ createdAt: -1 }).limit(200).select("number billType status paymentMode customerSnapshot items.qty grandTotal createdAt").lean(),
    Sale.aggregate<{ n: number; total: number }>([{ $match: { ...filter, status: status === "CANCELLED" ? "CANCELLED" : "PAID" } }, { $group: { _id: null, n: { $sum: 1 }, total: { $sum: "$grandTotal" } } }]),
  ]);
  const filtered = q || from || to || status || type;

  const stats = [
    { label: "Today", value: formatINRShort(daySum.revenue), sub: `${daySum.bills} bill${daySum.bills === 1 ? "" : "s"} · ${daySum.units} units`, icon: CalendarDays, c: "var(--sky)", s: "var(--sky-soft)" },
    { label: "This month", value: formatINRShort(monthSum.revenue), sub: `${monthSum.bills} bills · ${monthSum.units} units`, icon: TrendingUp, c: "var(--green)", s: "var(--green-soft)" },
    { label: "GST this month", value: formatINRShort(monthSum.tax), sub: "Included in sales", icon: IndianRupee, c: "var(--violet)", s: "var(--violet-soft)" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <span className="eyebrow">Sales</span>
          <h1 className="page-title display"><HoverLetters text="Sales history" /></h1>
        </div>
        <Link href="/admin/billing" className="btn btn-primary"><Plus /> New bill</Link>
      </div>

      <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {stats.map((x, i) => (
          <div key={x.label} className="card stat spotlight card-hover" style={{ animation: `rise .5s var(--ease) ${i * 60}ms both` }}>
            <span className="eyebrow">{x.label}</span>
            <div className="stat-icon" style={{ "--c": x.c, "--s": x.s } as React.CSSProperties}><x.icon /></div>
            <div className="stat-value" style={{ fontSize: 32 }}>{x.value}</div>
            <span className="hint">{x.sub}</span>
          </div>
        ))}
      </div>

      <form className="card row wrap" style={{ padding: 14, "--gap": "10px" } as React.CSSProperties}>
        <div className="input-wrap grow" style={{ minWidth: 220 }}>
          <Search className="icon-left" />
          <input name="q" defaultValue={q} className="input" placeholder="Bill no., customer, phone, product or barcode" style={{ height: 42 }} />
        </div>
        <label className="row hint" style={{ "--gap": "6px" } as React.CSSProperties}>From <input type="date" name="from" defaultValue={sp.from} className="input" style={{ height: 42, width: 160 }} /></label>
        <label className="row hint" style={{ "--gap": "6px" } as React.CSSProperties}>To <input type="date" name="to" defaultValue={sp.to} className="input" style={{ height: 42, width: 160 }} /></label>
        <select name="status" defaultValue={status} className="select" style={{ height: 42, width: 160 }} aria-label="Status">
          <option value="">All bills</option>
          <option value="CREDIT">On credit</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select name="type" defaultValue={type} className="select" style={{ height: 42, width: 140 }} aria-label="Bill type">
          <option value="">Bill + GST Bill</option>
          <option value="PLAIN">Bill only</option>
          <option value="GST">GST Bill only</option>
        </select>
        <button className="btn">Apply</button>
        {filtered && <Link href="/admin/sales" className="btn btn-ghost">Clear</Link>}
      </form>

      {filtered && (
        <div className="text-2" style={{ fontWeight: 650 }}>
          {filteredSum[0]?.n ?? 0} {status === "CANCELLED" ? "cancelled" : "paid"} bill{filteredSum[0]?.n === 1 ? "" : "s"} · {formatINR(filteredSum[0]?.total ?? 0)}
        </div>
      )}

      {sales.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon"><ReceiptText /></div>
          <strong style={{ color: "var(--text)" }}>{filtered ? "No bills match that filter" : "No sales yet"}</strong>
          <span>Bills you make on the Billing screen show up here.</span>
        </div>
      ) : (
        <div className="list">
          {sales.map((s, i) => (
            <Link key={String(s._id)} href={`/admin/sales/${s._id}`} className="list-row" style={{ gridTemplateColumns: "110px minmax(0,1fr) 90px 170px 130px 24px", "--i": Math.min(i, 12), opacity: s.status === "CANCELLED" ? 0.6 : 1 } as React.CSSProperties}>
              <span className="stack hide-sm" style={{ "--gap": "2px" } as React.CSSProperties}>
                <span className="mono" style={{ fontWeight: 700, color: "var(--accent)" }}>{invoiceCode(s.number, s.billType)}</span>
                <span className="muted" style={{ fontSize: 11.5, fontWeight: 700 }}>{s.billType === "PLAIN" ? "Bill" : "GST Bill"}</span>
              </span>
              <div className="stack" style={{ "--gap": "2px", minWidth: 0 } as React.CSSProperties}>
                <span className="row-title">{s.customerSnapshot.name}</span>
                <span className="row-sub">{s.customerSnapshot.phone && `${s.customerSnapshot.phone} · `}{fmtDate(s.createdAt)}</span>
              </div>
              <span className="hide-sm text-2" style={{ fontSize: 13.5 }}>{s.items.reduce((a, it) => a + it.qty, 0)} items</span>
              <span className="hide-sm"><SaleStatus status={s.status} paymentMode={s.paymentMode} /></span>
              <span className="display" style={{ fontSize: 19, justifySelf: "end", textDecoration: s.status === "CANCELLED" ? "line-through" : undefined }}>{formatINR(s.grandTotal)}</span>
              <ChevronRight className="go hide-sm" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
