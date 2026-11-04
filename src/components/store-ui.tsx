import { PAYMENT_LABEL, type PaymentMode } from "@/lib/store/money";
import { PURCHASE_LABEL, PURCHASE_SHORT, purchaseTypeOf } from "@/lib/store/bill-format";

/** How the product was bought: GST bill or normal bill without GST. */
export function PurchaseBadge({ type, long = false }: { type?: string; long?: boolean }) {
  const t = purchaseTypeOf(type);
  return <span className={`badge badge-${t}`} title={PURCHASE_LABEL[t]}>{long ? PURCHASE_LABEL[t] : PURCHASE_SHORT[t]}</span>;
}

export function StockBadge({ stock, low, unit = "" }: { stock: number; low: number; unit?: string }) {
  const cls = stock <= 0 ? "badge-REWORK" : stock <= low ? "badge-SUBMITTED" : "badge-COMPLETED";
  return <span className={`badge ${cls}`}>{stock <= 0 ? `Out of stock${stock < 0 ? ` (${stock})` : ""}` : `${stock} ${unit}`.trim()}</span>;
}

export function SaleStatus({ status, paymentMode }: { status: string; paymentMode: string }) {
  if (status === "CANCELLED") return <span className="badge badge-REWORK">Cancelled</span>;
  if (paymentMode === "CREDIT") return <span className="badge badge-SUBMITTED">On credit</span>;
  return <span className="badge badge-COMPLETED">Paid · {PAYMENT_LABEL[paymentMode as PaymentMode] ?? paymentMode}</span>;
}
