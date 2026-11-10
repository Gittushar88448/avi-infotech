import { notFound } from "next/navigation";
import { Quotation } from "@/lib/store/models";
import { quoteDTO } from "@/lib/store/quotes";
import { getBillSettings } from "@/lib/store/bill-settings";
import { QuoteDocument } from "@/components/quote-document";
import { PublicQuoteActions } from "./public-actions";

export const dynamic = "force-dynamic";

/** The customer's view-only link. The random token is the only key; nothing here needs a login. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const q = /^[\w-]{16,40}$/.test(token) ? await Quotation.findOne({ shareToken: token }).select("number").lean() : null;
  return { title: q ? `Quotation QT-${String(q.number).padStart(5, "0")}` : "Quotation", robots: { index: false, follow: false } };
}

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{16,40}$/.test(token)) notFound();
  const doc = await Quotation.findOne({ shareToken: token }).lean();
  if (!doc) notFound();
  const q = quoteDTO(doc);
  const { seller } = await getBillSettings();
  return (
    <main className="stack" style={{ "--gap": "16px", padding: "24px 16px 60px", maxWidth: 940, margin: "0 auto" } as React.CSSProperties}>
      <PublicQuoteActions q={{ ...q, saleId: "" }} seller={seller} />
      <QuoteDocument q={q} seller={seller} />
    </main>
  );
}
