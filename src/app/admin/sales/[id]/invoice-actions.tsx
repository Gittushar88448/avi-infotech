"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Ban, Printer } from "lucide-react";
import { useToast } from "@/components/providers";

export function PrintButton({ className = "btn btn-primary" }: { className?: string }) {
  return <button className={className} onClick={() => window.print()}><Printer /> Print / Save PDF</button>;
}

export function CancelBill({ id, code }: { id: string; code: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function cancel() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/sales/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't cancel the bill");
    toast({ kind: "success", title: `${code} cancelled`, body: "Items are back in stock." });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)}><Ban /> Cancel bill</button>
      {open && (
        <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="dialog stack">
            <h3 className="display" style={{ fontSize: 24 }}>Cancel {code}?</h3>
            <p className="text-2">The bill stays in the history marked as cancelled, and every item on it goes back into stock. This can't be undone.</p>
            <div className="field">
              <label className="label" htmlFor="cancel-reason">Reason</label>
              <input id="cancel-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer returned everything, wrong bill..." autoFocus />
            </div>
            {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Keep bill</button>
              <button className="btn btn-danger" onClick={cancel} disabled={busy || reason.trim().length < 3}>{busy ? <span className="spinner" /> : "Cancel bill"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
