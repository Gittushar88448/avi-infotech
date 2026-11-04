import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, ReceiptText } from "lucide-react";
import { isId } from "@/lib/db";
import { Product, Sale, StockMovement } from "@/lib/store/models";
import { listCategories, productDTO } from "@/lib/store/products";
import { formatINR, invoiceCode } from "@/lib/store/money";
import { fmtDate } from "@/lib/format";
import { StockBadge } from "@/components/store-ui";
import { EditProduct, StockButton, ToggleActive } from "../products-client";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  OPENING: "Opening stock",
  RESTOCK: "Restock",
  SALE: "Sold",
  SALE_CANCELLED: "Bill cancelled",
  ADJUSTMENT: "Correction",
  DAMAGED: "Damaged / lost",
  RETURN: "Customer return",
};

export default async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const doc = await Product.findById(id).populate<{ category: { name: string } }>("category", "name").lean();
  if (!doc) notFound();
  const p = productDTO(doc);

  const [categories, movements, sales, soldAgg] = await Promise.all([
    listCategories(),
    StockMovement.find({ product: id }).sort({ createdAt: -1 }).limit(50).populate<{ sale: { _id: unknown; number: number; billType?: string } | null; by: { name: string } | null }>([{ path: "sale", select: "number billType" }, { path: "by", select: "name" }]).lean(),
    Sale.find({ "items.product": id }).sort({ createdAt: -1 }).limit(30).select("number billType status customerSnapshot items createdAt").lean(),
    Sale.aggregate<{ units: number; revenue: number }>([
      { $match: { status: "PAID", "items.product": doc._id } },
      { $unwind: "$items" },
      { $match: { "items.product": doc._id } },
      { $group: { _id: null, units: { $sum: "$items.qty" }, revenue: { $sum: "$items.total" } } },
    ]),
  ]);
  const sold = soldAgg[0] ?? { units: 0, revenue: 0 };
  const facts: [string, React.ReactNode][] = [
    ["Barcode", p.barcode ? <span className="mono">{p.barcode}</span> : <span className="muted">None</span>],
    ["SKU", <span className="mono" key="sku">{p.sku}</span>],
    ["Category", p.category],
    ["Brand / model", [p.brand, p.model].filter(Boolean).join(" · ") || "—"],
    ["MRP", formatINR(p.mrp)],
    ["Selling price", formatINR(p.price)],
    ["Cost price", p.costPrice ? formatINR(p.costPrice) : "—"],
    ["GST", `${p.gstRate}% (included)`],
    ["HSN", p.hsn || "—"],
    ["Warranty", p.warrantyMonths ? `${p.warrantyMonths} months` : "—"],
    ["Low stock alert", `${p.lowStockAt} ${p.unit}`],
  ];

  return (
    <div className="page">
      <Link href="/admin/products" className="row muted" style={{ "--gap": "6px", fontWeight: 700, fontSize: 14 } as React.CSSProperties}><ArrowLeft style={{ width: 16 }} /> All products</Link>
      <div className="page-head">
        <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
          <span className="eyebrow">{p.category}{!p.active && " · Hidden"}</span>
          <h1 className="page-title display">{p.name}</h1>
          <div className="row wrap"><StockBadge stock={p.stock} low={p.lowStockAt} unit={`${p.unit} in stock`} /><span className="text-2" style={{ fontSize: 14 }}>{sold.units} sold · {formatINR(sold.revenue)} revenue</span></div>
        </div>
        <div className="row wrap">
          {p.active && <StockButton id={p.id} name={p.name} stock={p.stock} unit={p.unit} className="btn btn-primary btn-sm" />}
          <EditProduct product={p} categories={categories.map((c) => c.name)} />
          <ToggleActive id={p.id} name={p.name} active={p.active} />
        </div>
      </div>

      <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
        <section className="card stack">
          <span className="card-title">Details</span>
          <dl className="facts">
            {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {p.description && <p className="text-2" style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{p.description}</p>}
        </section>

        <div className="stack">
          <section className="card stack" style={{ padding: 0, overflow: "hidden" }}>
            <div className="row" style={{ padding: "18px 22px 0", "--gap": "8px" } as React.CSSProperties}><History style={{ width: 18 }} /><span className="card-title">Stock history</span></div>
            {movements.length === 0 ? (
              <div className="empty" style={{ padding: 30 }}>No stock changes yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>When</th><th>What</th><th className="num">Change</th><th className="num">Balance</th><th className="hide-sm">By</th></tr></thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={String(m._id)}>
                        <td className="muted" style={{ fontSize: 13 }}>{fmtDate(m.createdAt)}</td>
                        <td>
                          {REASON_LABEL[m.reason] ?? m.reason}
                          {m.sale && <> · <Link className="link-underline mono" style={{ color: "var(--accent)" }} href={`/admin/sales/${m.sale._id}`}>{invoiceCode(m.sale.number, m.sale.billType)}</Link></>}
                          {m.note && <div className="row-sub" style={{ whiteSpace: "normal" }}>{m.note}</div>}
                        </td>
                        <td className="num mono" style={{ fontWeight: 750, color: m.change > 0 ? "var(--green)" : "var(--rose)" }}>{m.change > 0 ? `+${m.change}` : m.change}</td>
                        <td className="num mono">{m.balanceAfter}</td>
                        <td className="hide-sm text-2">{m.by?.name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card stack" style={{ padding: 0, overflow: "hidden" }}>
            <div className="row" style={{ padding: "18px 22px 0", "--gap": "8px" } as React.CSSProperties}><ReceiptText style={{ width: 18 }} /><span className="card-title">Sold to</span></div>
            {sales.length === 0 ? (
              <div className="empty" style={{ padding: 30 }}>Not sold yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Bill</th><th>Customer</th><th className="num">Qty</th><th className="num hide-sm">Amount</th></tr></thead>
                  <tbody>
                    {sales.map((s) => {
                      const mine = s.items.filter((i) => String(i.product) === id);
                      return (
                        <tr key={String(s._id)} style={{ opacity: s.status === "CANCELLED" ? 0.55 : 1 }}>
                          <td><Link href={`/admin/sales/${s._id}`} className="mono link-underline" style={{ color: "var(--accent)", fontWeight: 700 }}>{invoiceCode(s.number, s.billType)}</Link><div className="row-sub">{fmtDate(s.createdAt)}{s.status === "CANCELLED" && " · cancelled"}</div></td>
                          <td>{s.customerSnapshot.name}<div className="row-sub mono">{s.customerSnapshot.phone}</div></td>
                          <td className="num">{mine.reduce((a, i) => a + i.qty, 0)}</td>
                          <td className="num hide-sm">{formatINR(mine.reduce((a, i) => a + i.total, 0))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
