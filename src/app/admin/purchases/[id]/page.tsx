import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Package } from "lucide-react";
import { isId } from "@/lib/db";
import { PurchaseBill, StockMovement } from "@/lib/store/models";
import { purchaseBillDTO } from "@/lib/store/purchase-bills";
import { formatINR } from "@/lib/store/money";
import { fmtDate } from "@/lib/format";
import { PurchaseBadge } from "@/components/store-ui";
import { AddBillFiles } from "../purchases-client";

export const dynamic = "force-dynamic";

export default async function PurchaseBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const doc = await PurchaseBill.findById(id).populate<{ by: { name: string } | null }>("by", "name").lean();
  if (!doc) notFound();
  const b = purchaseBillDTO(doc);
  const lines = await StockMovement.find({ purchaseBill: id })
    .sort({ createdAt: 1 })
    .populate<{ product: { _id: unknown; name: string; unit: string; barcode?: string; sku: string } | null }>("product", "name unit barcode sku")
    .lean();

  const facts: [string, React.ReactNode][] = [
    ["Type", <PurchaseBadge key="t" type={b.billType} long />],
    ["Supplier", b.supplier || "—"],
    ["Bill no.", b.billNo ? <span className="mono" key="n">{b.billNo}</span> : "—"],
    ["Bill date", b.billDate ? new Date(b.billDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"],
    ["Bill total", b.amount ? formatINR(b.amount) : "—"],
    ["Entered", `${fmtDate(doc.createdAt)}${doc.by ? ` by ${doc.by.name}` : ""}`],
  ];

  return (
    <div className="page">
      <Link href="/admin/purchases" className="row muted" style={{ "--gap": "6px", fontWeight: 700, fontSize: 14 } as React.CSSProperties}><ArrowLeft style={{ width: 16 }} /> All purchase bills</Link>
      <div className="page-head">
        <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
          <span className="eyebrow">Purchase bill</span>
          <h1 className="page-title display">{b.supplier || "Supplier not entered"}{b.billNo && <span className="muted"> · {b.billNo}</span>}</h1>
        </div>
        <AddBillFiles id={b.id} />
      </div>

      <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
        <section className="card stack">
          <span className="card-title">Details</span>
          <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {b.notes && <p className="text-2" style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{b.notes}</p>}
        </section>

        <div className="stack">
          <section className="card stack">
            <span className="card-title">Bill copy</span>
            {b.files.length === 0 ? (
              <div className="empty" style={{ padding: 20 }}>No photo or PDF yet. Use Add photo / PDF to keep a copy.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                {b.files.map((f) => (
                  <a key={f.name} href={`/api/files/${f.name}`} target="_blank" rel="noreferrer" className="card stack" style={{ "--gap": "6px", padding: 8, boxShadow: "none", border: "1px solid var(--border)" } as React.CSSProperties}>
                    {f.type === "application/pdf" ? (
                      <div className="empty" style={{ height: 140, padding: 0, justifyContent: "center" }}><FileText style={{ width: 40, height: 40 }} />PDF</div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/files/${f.name}`} alt={f.original} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8 }} />
                    )}
                    <span className="hint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.original || f.name}</span>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="card stack" style={{ padding: 0, overflow: "hidden" }}>
            <div className="row" style={{ padding: "18px 22px 0", "--gap": "8px" } as React.CSSProperties}><Package style={{ width: 18 }} /><span className="card-title">Stock received on this bill</span></div>
            {lines.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>No products linked yet. Choose this bill under “Bill entered earlier” when you add a product or restock.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Product</th><th className="num">Qty</th><th className="hide-sm">When</th></tr></thead>
                  <tbody>
                    {lines.map((m) => (
                      <tr key={String(m._id)}>
                        <td>{m.product ? <Link href={`/admin/products/${m.product._id}`} className="link-underline" style={{ fontWeight: 700 }}>{m.product.name}</Link> : "Deleted product"}<div className="row-sub mono">{m.product?.barcode || m.product?.sku}</div></td>
                        <td className="num mono" style={{ fontWeight: 750, color: "var(--green)" }}>+{m.change} {m.product?.unit}</td>
                        <td className="hide-sm muted" style={{ fontSize: 13 }}>{fmtDate(m.createdAt)}</td>
                      </tr>
                    ))}
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
