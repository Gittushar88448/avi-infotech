import { PAYMENT_LABEL, type PaymentMode } from "@/lib/store/money";

export function StockBadge({ stock, low, unit = "" }: { stock: number; low: number; unit?: string }) {
  const cls = stock <= 0 ? "badge-REWORK" : stock <= low ? "badge-SUBMITTED" : "badge-COMPLETED";
  return <span className={`badge ${cls}`}>{stock <= 0 ? `Out of stock${stock < 0 ? ` (${stock})` : ""}` : `${stock} ${unit}`.trim()}</span>;
}

export function SaleStatus({ status, paymentMode }: { status: string; paymentMode: string }) {
  if (status === "CANCELLED") return <span className="badge badge-REWORK">Cancelled</span>;
  if (paymentMode === "CREDIT") return <span className="badge badge-SUBMITTED">On credit</span>;
  return <span className="badge badge-COMPLETED">Paid · {PAYMENT_LABEL[paymentMode as PaymentMode] ?? paymentMode}</span>;
}
