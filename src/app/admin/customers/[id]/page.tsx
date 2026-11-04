import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone, Plus, ReceiptText } from "lucide-react";
import { isId } from "@/lib/db";
import { Customer, Sale } from "@/lib/store/models";
import { customerTotals } from "@/lib/store/customers";
import { formatINR, invoiceCode } from "@/lib/store/money";
import { fmtDate } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { SaleStatus } from "@/components/store-ui";

export const dynamic = "force-dynamic";

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const customer = await Customer.findById(id).lean();
  if (!customer) notFound();
  const [sales, totals] = await Promise.all([Sale.find({ customer: id }).sort({ createdAt: -1 }).limit(200).lean(), customerTotals([id])]);
  const t = totals[id] ?? { bills: 0, spent: 0, units: 0 };

  return (
    <div className="page">
      <div className="row wrap between">
        <Link href="/admin/customers" className="row muted" style={{ "--gap": "6px", fontWeight: 700, fontSize: 14 } as React.CSSProperties}><ArrowLeft style={{ width: 16 }} /> All customers</Link>
        <Link href={`/admin/billing?customer=${id}`} className="btn btn-primary"><Plus /> New bill for this customer</Link>
      </div>
      <div className="card row wrap between">
        <div className="row" style={{ "--gap": "16px" } as React.CSSProperties}>
          <Avatar name={customer.name} size={56} />
          <div className="stack" style={{ "--gap": "4px" } as React.CSSProperties}>
            <h1 className="display" style={{ fontSize: 28 }}>{customer.name}</h1>
            <div className="row wrap text-2" style={{ fontSize: 14, "--gap": "14px" } as React.CSSProperties}>
              <span className="row" style={{ "--gap": "6px" } as React.CSSProperties}><Phone style={{ width: 15 }} /><span className="mono">{customer.phone}</span></span>
              {customer.email && <span className="row" style={{ "--gap": "6px" } as React.CSSProperties}><Mail style={{ width: 15 }} />{customer.email}</span>}
              {customer.address && <span className="row" style={{ "--gap": "6px" } as React.CSSProperties}><MapPin style={{ width: 15 }} />{customer.address}</span>}
              {customer.gstin && <span className="mono">GSTIN {customer.gstin}</span>}
            </div>
          </div>
        </div>
        <div className="row" style={{ "--gap": "24px" } as React.CSSProperties}>
          <div><div className="display" style={{ fontSize: 26 }}>{t.bills}</div><div className="eyebrow" style={{ fontSize: 10 }}>Bills</div></div>
          <div><div className="display" style={{ fontSize: 26 }}>{t.units}</div><div className="eyebrow" style={{ fontSize: 10 }}>Items bought</div></div>
          <div><div className="display" style={{ fontSize: 26 }}>{formatINR(t.spent)}</div><div className="eyebrow" style={{ fontSize: 10 }}>Total spent</div></div>
        </div>
      </div>

      <span className="card-title">Purchase history</span>
      {sales.length === 0 ? (
        <div className="card empty"><div className="empty-icon"><ReceiptText /></div>No bills yet.</div>
      ) : (
        <div className="stack" style={{ "--gap": "12px" } as React.CSSProperties}>
          {sales.map((s) => (
            <section key={String(s._id)} className="card stack" style={{ padding: 0, overflow: "hidden", opacity: s.status === "CANCELLED" ? 0.6 : 1 }}>
              <div className="row wrap between" style={{ padding: "14px 20px 0" }}>
                <div className="row" style={{ "--gap": "10px" } as React.CSSProperties}>
                  <Link href={`/admin/sales/${s._id}`} className="mono link-underline" style={{ color: "var(--accent)", fontWeight: 750 }}>{invoiceCode(s.number, s.billType)}</Link>
                  <span className="muted" style={{ fontSize: 13 }}>{fmtDate(s.createdAt)}</span>
                </div>
                <div className="row" style={{ "--gap": "10px" } as React.CSSProperties}>
                  <SaleStatus status={s.status} paymentMode={s.paymentMode} />
                  <span className="display" style={{ fontSize: 18 }}>{formatINR(s.grandTotal)}</span>
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {s.items.map((it, i) => (
                      <tr key={String(it._id ?? i)}>
                        <td><Link href={`/admin/products/${it.product}`} style={{ fontWeight: 650 }}>{it.name}</Link><div className="row-sub mono">{it.barcode || it.sku}{it.warrantyMonths > 0 && ` · ${it.warrantyMonths}m warranty`}</div></td>
                        <td className="num" style={{ width: 70 }}>× {it.qty}</td>
                        <td className="num" style={{ width: 130 }}>{formatINR(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
