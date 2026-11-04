"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Paperclip, Plus, Save } from "lucide-react";
import { useToast } from "@/components/providers";
import { PurchaseBillFields, billHasDetails, emptyBill, savePurchaseBill, type BillDraft } from "@/components/purchase-bill-fields";

/** Enter a supplier bill on its own (stock can be linked to it later from Restock / Add product). */
export function NewPurchaseBill() {
  const [open, setOpen] = useState(false);
  const [bill, setBill] = useState<BillDraft>(() => emptyBill("GST"));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function save() {
    setError("");
    if (!billHasDetails(bill)) return setError("Enter the supplier or bill number, or attach the bill.");
    setBusy(true);
    const r = await savePurchaseBill(bill);
    setBusy(false);
    if (r.error) return setError(r.error);
    toast({ kind: "success", title: "Purchase bill saved" });
    setOpen(false);
    setBill(emptyBill(bill.billType));
    router.push(`/admin/purchases/${r.id}`);
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus /> Add purchase bill</button>
      {open && (
        <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="dialog stack" style={{ width: "min(640px, 100%)", maxHeight: "calc(100dvh - 32px)", overflowY: "auto" }}>
            <h3 className="display" style={{ fontSize: 24 }}>Add purchase bill</h3>
            <PurchaseBillFields value={{ ...bill, mode: "new" }} onChange={(d) => setBill({ ...d, mode: "new" })} title="Supplier's bill" />
            {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : <><Save /> Save bill</>}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Attach more pages / a scanned copy to an existing bill. */
export function AddBillFiles({ id }: { id: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    const form = new FormData();
    for (const f of Array.from(list)) form.append("files", f);
    setBusy(true);
    const res = await fetch(`/api/purchase-bills/${id}/files`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast({ kind: "error", title: "Upload failed", body: data.error ?? "Try again" });
    toast({ kind: "success", title: "Bill file added" });
    router.refresh();
  }

  return (
    <>
      <button className="btn btn-sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? <span className="spinner" /> : <><Paperclip /> Add photo / PDF</>}</button>
      <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
    </>
  );
}
