"use client";

import { useState } from "react";
import { Check, Download, Link2, Mail, MessageCircle, Printer, Share2 } from "lucide-react";
import { useToast } from "@/components/providers";
import { formatINR } from "@/lib/store/money";
import type { QuoteDTO } from "@/lib/store/quotes";
import type { ISeller } from "@/lib/store/models";

/** WhatsApp wants the number with country code and no symbols. 10-digit Indian numbers get 91. */
const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

/**
 * Download / share buttons for a quotation. The PDF is generated in the browser, so it works the
 * same for the admin and on the customer's link. onShared runs after any share (used to mark a
 * draft as sent).
 */
export function QuoteShare({ q, seller, onShared, compact = false }: { q: QuoteDTO; seller: ISeller; onShared?: () => void; compact?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = () => `${window.location.origin}/quote/${q.shareToken}`;
  const message = () =>
    `Dear ${q.customer.name},\nPlease find our quotation ${q.code}${q.subject ? ` for ${q.subject}` : ""}.\nTotal: ${formatINR(q.grandTotal)}${q.validUntil ? `, valid until ${new Date(`${q.validUntil}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : ""}.\nView or download: ${link()}\n\n${seller.companyName}${seller.phone ? `\n${seller.phone}` : ""}`;

  async function pdf() {
    const { buildQuotePdf } = await import("@/lib/quote-pdf");
    return buildQuotePdf(q, seller);
  }

  async function download() {
    setBusy("download");
    try {
      const { doc, filename } = await pdf();
      doc.save(filename);
      toast({ kind: "success", title: "PDF downloaded", body: filename });
    } catch {
      toast({ kind: "error", title: "Couldn't make the PDF" });
    }
    setBusy(null);
  }

  async function sharePdf() {
    setBusy("share");
    try {
      const { blob, filename } = await pdf();
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Quotation ${q.code}`, text: message() });
        onShared?.();
      } else if (navigator.share) {
        await navigator.share({ title: `Quotation ${q.code}`, text: message(), url: link() });
        onShared?.();
      } else {
        await copy();
        toast({ kind: "info", title: "Link copied", body: "This browser can't share files. Paste the link, or download the PDF and attach it." });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast({ kind: "error", title: "Couldn't share" });
    }
    setBusy(null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
    } catch {
      window.prompt("Copy this link", link());
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShared?.();
  }

  const whatsapp = () => {
    window.open(`https://wa.me/${waNumber(q.customer.phone)}?text=${encodeURIComponent(message())}`, "_blank", "noopener");
    onShared?.();
  };
  const email = () => {
    window.location.href = `mailto:${q.customer.email}?subject=${encodeURIComponent(`Quotation ${q.code} from ${seller.companyName}`)}&body=${encodeURIComponent(message())}`;
    onShared?.();
  };

  return (
    <div className="row wrap" style={{ "--gap": "8px" } as React.CSSProperties}>
      <button type="button" className="btn btn-primary" onClick={download} disabled={!!busy}>{busy === "download" ? <span className="spinner" /> : <><Download /> Download PDF</>}</button>
      <button type="button" className="btn" onClick={sharePdf} disabled={!!busy} title="Share the PDF to WhatsApp, Gmail or any app (phones)">{busy === "share" ? <span className="spinner" /> : <><Share2 /> Share PDF</>}</button>
      <button type="button" className="btn" onClick={whatsapp} title={q.customer.phone ? `Send to ${q.customer.phone} on WhatsApp` : "Open WhatsApp with the message"}><MessageCircle /> WhatsApp</button>
      {!compact && <button type="button" className="btn" onClick={copy}>{copied ? <><Check /> Copied</> : <><Link2 /> Copy link</>}</button>}
      {!compact && q.customer.email && <button type="button" className="btn" onClick={email}><Mail /> Email</button>}
      <button type="button" className="btn btn-ghost" onClick={() => window.print()}><Printer /> Print</button>
    </div>
  );
}
