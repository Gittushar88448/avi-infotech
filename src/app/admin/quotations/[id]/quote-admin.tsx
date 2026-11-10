"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Copy, Pencil, ReceiptText, RotateCcw, Send, Trash2, XCircle } from "lucide-react";
import { useToast } from "@/components/providers";
import { QuoteShare } from "@/components/quote-share";
import { invoiceCode } from "@/lib/store/money";
import type { QuoteDTO } from "@/lib/store/quotes";
import type { ISeller } from "@/lib/store/models";

export function QuoteAdminActions({ q, seller, sale }: { q: QuoteDTO; seller: ISeller; sale: { number: number; billType?: string } | null }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const billed = q.status === "CONVERTED";

  async function status(s: string, quiet = false) {
    const res = await fetch(`/api/quotations/${q.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
    if (!res.ok) return toast({ kind: "error", title: (await res.json().catch(() => ({}))).error ?? "Couldn't update" });
    if (!quiet) toast({ kind: "success", title: `Marked as ${s.toLowerCase()}` });
    router.refresh();
  }
  async function duplicate() {
    setBusy(true);
    const res = await fetch(`/api/quotations/${q.id}/duplicate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast({ kind: "error", title: data.error ?? "Couldn't duplicate" });
    toast({ kind: "success", title: "Copy created", body: "Edit it and save." });
    router.push(`/admin/quotations/${data.id}/edit`);
  }
  async function remove() {
    if (!window.confirm(`Delete quotation ${q.code}? This can't be undone.`)) return;
    const res = await fetch(`/api/quotations/${q.id}`, { method: "DELETE" });
    if (!res.ok) return toast({ kind: "error", title: (await res.json().catch(() => ({}))).error ?? "Couldn't delete" });
    toast({ kind: "success", title: "Quotation deleted" });
    router.push("/admin/quotations");
  }

  return (
    <div className="stack quote-actions" style={{ "--gap": "10px" } as React.CSSProperties}>
      <QuoteShare q={q} seller={seller} onShared={() => q.status === "DRAFT" && status("SENT", true)} />
      <div className="row wrap" style={{ "--gap": "8px" } as React.CSSProperties}>
        {billed ? (
          sale && <Link href={`/admin/sales/${q.saleId}`} className="btn btn-sm"><ReceiptText /> Billed as {invoiceCode(sale.number, sale.billType)}</Link>
        ) : (
          <>
            <Link href={`/admin/quotations/${q.id}/edit`} className="btn btn-sm"><Pencil /> Edit</Link>
            {q.status !== "SENT" && <button className="btn btn-sm" onClick={() => status("SENT")}><Send /> Mark sent</button>}
            {q.status !== "ACCEPTED" && <button className="btn btn-sm" onClick={() => status("ACCEPTED")}><CheckCircle2 /> Accepted</button>}
            {q.status !== "REJECTED" && <button className="btn btn-sm" onClick={() => status("REJECTED")}><XCircle /> Rejected</button>}
            {q.status !== "DRAFT" && <button className="btn btn-sm btn-ghost" onClick={() => status("DRAFT")}><RotateCcw /> Back to draft</button>}
            <Link href={`/admin/billing?quote=${q.id}`} className="btn btn-sm btn-primary"><ReceiptText /> Make bill from this</Link>
          </>
        )}
        <button className="btn btn-sm" onClick={duplicate} disabled={busy}><Copy /> Duplicate</button>
        {!billed && <button className="btn btn-sm btn-ghost" onClick={remove}><Trash2 /> Delete</button>}
      </div>
    </div>
  );
}
