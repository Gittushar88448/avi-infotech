import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Plus, Settings2 } from "lucide-react";
import { isId } from "@/lib/db";
import { Sale } from "@/lib/store/models";
import { getBillSettings } from "@/lib/store/bill-settings";
import { BILL_TYPE_LABEL, billTypeOf } from "@/lib/store/bill-format";
import { PAYMENT_LABEL, invoiceCode } from "@/lib/store/money";
import { CancelBill, PrintButton } from "./invoice-actions";
import { GstInvoice, PlainBill, type BillData } from "./bill-templates";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = isId(id) ? await Sale.findById(id).select("number billType").lean() : null;
  return { title: s ? invoiceCode(s.number, s.billType) : "Bill" };
}

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  if (!isId(id)) notFound();
  const [sale, settings] = await Promise.all([
    Sale.findById(id).populate<{ cancelledBy: { name: string } | null }>("cancelledBy", "name").lean(),
    getBillSettings(),
  ]);
  if (!sale) notFound();
  const billType = billTypeOf(sale.billType);
  const code = invoiceCode(sale.number, billType);
  const cancelled = sale.status === "CANCELLED";

  const data: BillData = {
    number: sale.number,
    billType,
    createdAt: new Date(sale.createdAt),
    cancelled,
    // Bills keep the shop details they were made with; very old bills fall back to today's settings.
    seller: { ...settings.seller, ...(sale.seller ?? {}) },
    buyer: sale.customerSnapshot,
    consignee: sale.consignee ?? null,
    details: sale.details ?? {},
    interState: !!sale.interState,
    items: sale.items,
    gross: sale.gross,
    discount: sale.discount,
    taxable: sale.taxable,
    tax: sale.tax,
    roundOff: sale.roundOff,
    grandTotal: sale.grandTotal,
    paymentLabel: PAYMENT_LABEL[sale.paymentMode] ?? sale.paymentMode,
    notes: sale.notes,
    sections: settings.sections[billType],
  };

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="row wrap between no-print">
        <Link href="/admin/sales" className="row muted" style={{ "--gap": "6px", fontWeight: 700, fontSize: 14 } as React.CSSProperties}><ArrowLeft style={{ width: 16 }} /> Sales history</Link>
        <div className="row wrap">
          <Link href="/admin/bill-settings" className="btn btn-ghost" title="Company details and what each bill prints"><Settings2 /> Bill settings</Link>
          {!cancelled && <CancelBill id={id} code={code} />}
          <Link href="/admin/billing" className="btn"><Plus /> New bill</Link>
          <PrintButton />
        </div>
      </div>
      {isNew && !cancelled && <div className="alert alert-success no-print"><CheckCircle2 /> {BILL_TYPE_LABEL[billType]} {code} saved and stock updated.</div>}
      {cancelled && (
        <div className="alert alert-error no-print">
          Cancelled {sale.cancelledAt && new Date(sale.cancelledAt).toLocaleString("en-IN")} by {sale.cancelledBy?.name ?? "admin"}: {sale.cancelReason}. Items were returned to stock.
        </div>
      )}
      <div className="invoice-sheet">{billType === "GST" ? <GstInvoice d={data} /> : <PlainBill d={data} />}</div>
    </div>
  );
}
