import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isId } from "@/lib/db";
import { Quotation } from "@/lib/store/models";
import { quoteDTO } from "@/lib/store/quotes";
import { getBillSettings } from "@/lib/store/bill-settings";
import { QuoteBuilder } from "../../quote-builder";

export const dynamic = "force-dynamic";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const doc = await Quotation.findById(id).lean();
  if (!doc) notFound();
  if (doc.status === "CONVERTED") redirect(`/admin/quotations/${id}`);
  const q = quoteDTO(doc);
  const { seller } = await getBillSettings();
  return (
    <div className="page" style={{ maxWidth: 1360 }}>
      <Link href={`/admin/quotations/${id}`} className="row muted" style={{ "--gap": "6px", fontWeight: 700, fontSize: 14 } as React.CSSProperties}><ArrowLeft style={{ width: 16 }} /> Back to {q.code}</Link>
      <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
        <span className="eyebrow">Edit quotation</span>
        <h1 className="page-title display">{q.code}</h1>
      </div>
      <QuoteBuilder key={q.updatedAt} initial={q} defaultTerms={seller.terms} sellerStateCode={seller.stateCode} />
    </div>
  );
}
