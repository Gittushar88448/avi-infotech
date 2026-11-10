"use client";

import { QuoteShare } from "@/components/quote-share";
import type { QuoteDTO } from "@/lib/store/quotes";
import type { ISeller } from "@/lib/store/models";

export function PublicQuoteActions({ q, seller }: { q: QuoteDTO; seller: ISeller }) {
  return (
    <div className="quote-actions row between wrap" style={{ top: 0 }}>
      <span className="text-2"><b>{seller.companyName}</b> sent you quotation <b className="mono">{q.code}</b></span>
      <QuoteShare q={q} seller={seller} compact />
    </div>
  );
}
