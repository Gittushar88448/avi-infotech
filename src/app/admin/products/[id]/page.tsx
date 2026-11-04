import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileStack, History, Paperclip, ReceiptText } from "lucide-react";
import { isId } from "@/lib/db";
import { Product, Sale, StockMovement } from "@/lib/store/models";
import type { PurchaseType } from "@/lib/store/bill-format";
import { listCategories, productDTO } from "@/lib/store/products";
import { formatINR, invoiceCode } from "@/lib/store/money";
import { fmtDate } from "@/lib/format";
import { PurchaseBadge, StockBadge } from "@/components/store-ui";
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

type BillRef = { _id: unknown; billType: PurchaseType; supplier: string; billNo: string; billDate?: Date; files: unknown[] };
const BILL_FILTERS = [
  { v: "", l: "All" },
  { v: "LOCAL", l: "Normal bill" },
  { v: "GST", l: "GST bill" },
] as const;

export default async function ProductDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bill?: string }> }) {
  const { id } = await params;
  const billParam = (await searchParams).bill;
  const billFilter = billParam === "GST" || billParam === "LOCAL" ? billParam : "";
  if (!isId(id)) notFound();
  const doc = await Product.findById(id).populate<{ category: { name: string } }>("category", "name").lean();
  if (!doc) notFound();
  const p = productDTO(doc);

  const [categories, movements, sales, soldAgg, purchases] = await Promise.all([
    listCategories(),
    StockMovement.find({ product: id }).sort({ createdAt: -1 }).limit(50).populate<{ sale: { _id: unknown; number: number; billType?: string } | null; by: { name: string } | null; purchaseBill: BillRef | null }>([{ path: "sale", select: "number billType" }, { path: "by", select: "name" }, { path: "purchaseBill", select: "billType supplier billNo billDate files" }]).lean(),
    Sale.find({ "items.product": id }).sort({ createdAt: -1 }).limit(30).select("number billType status customerSnapshot items createdAt").lean(),
    Sale.aggregate<{ units: number; revenue: number }>([
      { $match: { status: "PAID", "items.product": doc._id } },
      { $unwind: "$items" },
      { $match: { "items.product": doc._id } },
      { $group: { _id: null, units: { $sum: "$items.qty" }, revenue: { $sum: "$items.total" } } },
    ]),
    // Every time stock came in on a supplier bill (opening stock, restock, CSV import with a bill).
    StockMovement.find({ product: id, purchaseBill: { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate<{ purchaseBill: BillRef | null }>("purchaseBill", "billType supplier billNo billDate files")
      .lean(),
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
    ["Bought with", <PurchaseBadge key="pt" type={p.purchaseType} long />],
    ["HSN", p.hsn || "—"],
    ["Warranty", p.warrantyMonths ? `${p.warrantyMonths} months` : "—"],
    ["Low stock alert", `${p.lowStockAt} ${p.unit}`],
  ];

  const withBill = purchases.filter((m) => m.purchaseBill);
  const unitsBy = (t: PurchaseType) => withBill.filter((m) => m.purchaseBill!.billType === t).reduce((n, m) => n + m.change, 0);
  const shownPurchases = billFilter ? withBill.filter((m) => m.purchaseBill!.billType === billFilter) : withBill;
  const billText = (b: BillRef) => [b.supplier, b.billNo && `Bill ${b.billNo}`, b.billDate && new Date(b.billDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })].filter(Boolean).join(" · ") || "Purchase bill";

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
          {p.active && <StockButton id={p.id} name={p.name} stock={p.stock} unit={p.unit} purchaseType={p.purchaseType} className="btn btn-primary btn-sm" />}
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
            <div className="row wrap between" style={{ padding: "18px 22px 0", "--gap": "8px" } as React.CSSProperties}>
              <span className="row" style={{ "--gap": "8px" } as React.CSSProperties}><FileStack style={{ width: 18 }} /><span className="card-title">Purchases by bill type</span></span>
              <nav className="tabs" aria-label="Filter purchases by bill type">
                {BILL_FILTERS.map((f) => (
                  <Link key={f.v} href={`/admin/products/${id}${f.v ? `?bill=${f.v}` : ""}`} className="tab" data-active={billFilter === f.v} scroll={false}>
                    {f.l}
                    {f.v && <small>{unitsBy(f.v)}</small>}
                  </Link>
                ))}
              </nav>
            </div>
            <span className="hint" style={{ padding: "0 22px" }}>Bought on normal bills: <b>{unitsBy("LOCAL")}</b> {p.unit} · on GST bills: <b>{unitsBy("GST")}</b> {p.unit}</span>
            {shownPurchases.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>{billFilter ? "No purchases on this bill type." : "No purchase bills linked yet. Attach one when you restock."}</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Bill</th><th>Type</th><th className="num">Qty</th><th className="hide-sm">Entered</th></tr></thead>
                  <tbody>
                    {shownPurchases.map((m) => (
                      <tr key={String(m._id)}>
                        <td>
                          <Link href={`/admin/purchases/${m.purchaseBill!._id}`} className="link-underline" style={{ color: "var(--accent)", fontWeight: 700 }}>{billText(m.purchaseBill!)}</Link>
                          {m.purchaseBill!.files.length > 0 && <span className="row-sub row" style={{ "--gap": "4px" } as React.CSSProperties}><Paperclip style={{ width: 13 }} />{m.purchaseBill!.files.length} file{m.purchaseBill!.files.length > 1 ? "s" : ""}</span>}
                        </td>
                        <td><PurchaseBadge type={m.purchaseBill!.billType} /></td>
                        <td className="num mono" style={{ fontWeight: 750, color: "var(--green)" }}>+{m.change}</td>
                        <td className="hide-sm muted" style={{ fontSize: 13 }}>{fmtDate(m.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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
                          {m.purchaseBill && <> · <Link className="link-underline" style={{ color: "var(--accent)" }} href={`/admin/purchases/${m.purchaseBill._id}`}>{m.purchaseBill.billType === "GST" ? "GST bill" : "Normal bill"}</Link></>}
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
