import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isId } from "@/lib/db";
import { Quotation, Sale } from "@/lib/store/models";
import { quoteDTO } from "@/lib/store/quotes";
import { getBillSettings } from "@/lib/store/bill-settings";
import { QuoteDocument } from "@/components/quote-document";
import { QuoteStatusBadge } from "../status";
import { QuoteAdminActions } from "./quote-admin";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const doc = await Quotation.findById(id).lean();
  if (!doc) notFound();
  const q = quoteDTO(doc);
  const [{ seller }, sale] = await Promise.all([getBillSettings(), q.saleId ? Sale.findById(q.saleId).select("number billType").lean() : null]);
  const expired = q.validUntil && q.status !== "CONVERTED" && new Date(`${q.validUntil}T23:59:59`) < new Date();

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <Link href="/admin/quotations" className="row muted" style={{ "--gap": "6px", fontWeight: 700, fontSize: 14 } as React.CSSProperties}><ArrowLeft style={{ width: 16 }} /> All quotations</Link>
      <div className="row between wrap">
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <span className="eyebrow">Quotation</span>
          <h1 className="page-title display">{q.code} <span className="muted" style={{ fontSize: "0.6em" }}>· {q.customer.name}</span></h1>
        </div>
        <div className="row" style={{ "--gap": "8px" } as React.CSSProperties}>
          <QuoteStatusBadge status={q.status} />
          {expired && <span className="badge badge-REJECTED">Expired</span>}
        </div>
      </div>
      <QuoteAdminActions q={q} seller={seller} sale={sale ? { number: sale.number, billType: sale.billType } : null} />
      <QuoteDocument q={q} seller={seller} />
    </div>
  );
}
