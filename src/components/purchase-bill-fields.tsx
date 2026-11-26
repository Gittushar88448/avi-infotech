"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Paperclip, X } from "lucide-react";
import { PURCHASE_TYPES, type PurchaseType } from "@/lib/store/bill-format";
import { formatINR } from "@/lib/store/money";
import type { PurchaseBillDTO } from "@/lib/store/purchase-bills";

/**
 * The supplier's bill for stock being added: GST or Without GST, with supplier,
 * bill number, date, amount and photos/PDFs of the paper bill. Either a new bill, or one entered
 * earlier (when several products came on the same bill).
 */
export type BillDraft = {
  mode: "new" | "existing";
  existingId: string;
  billType: PurchaseType;
  supplier: string;
  billNo: string;
  billDate: string;
  amount: string;
  notes: string;
  files: File[];
};

export const emptyBill = (billType: PurchaseType = "GST"): BillDraft => ({
  mode: "new",
  existingId: "",
  billType,
  supplier: "",
  billNo: "",
  billDate: new Date().toISOString().slice(0, 10),
  amount: "",
  notes: "",
  files: [],
});

const TYPE_TEXT: Record<PurchaseType, string> = { LOCAL: "Without GST", GST: "GST" };

/** True when a new bill has something worth saving. */
export const billHasDetails = (d: BillDraft) => d.mode === "existing" ? !!d.existingId : !!(d.supplier.trim() || d.billNo.trim() || d.files.length);

/** Saves a new bill (if anything was entered) and returns its id; returns the chosen id for an earlier bill. */
export async function savePurchaseBill(d: BillDraft): Promise<{ id: string | null; error?: string }> {
  if (d.mode === "existing") return { id: d.existingId || null };
  if (!billHasDetails(d)) return { id: null };
  const form = new FormData();
  for (const k of ["billType", "supplier", "billNo", "billDate", "amount", "notes"] as const) form.set(k, d[k]);
  for (const f of d.files) form.append("files", f);
  const res = await fetch("/api/purchase-bills", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { id: null, error: data.error ?? "Couldn't save the purchase bill" };
  return { id: data.id };
}

export function PurchaseBillFields({ value, onChange, title = "Purchase bill" }: { value: BillDraft; onChange: (d: BillDraft) => void; title?: string }) {
  const [recent, setRecent] = useState<PurchaseBillDTO[] | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<BillDraft>) => onChange({ ...value, ...patch });

  useEffect(() => {
    if (value.mode !== "existing" || recent) return;
    fetch("/api/purchase-bills?limit=40", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setRecent(d.items))
      .catch(() => setRecent([]));
  }, [value.mode, recent]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    set({ files: [...value.files, ...Array.from(list)].slice(0, 10) });
  };
  const label = (b: PurchaseBillDTO) => [b.supplier, b.billNo && `Bill ${b.billNo}`, b.billDate].filter(Boolean).join(" · ") || "Purchase bill";

  return (
    <fieldset className="card stack" style={{ "--gap": "12px", padding: 14, border: "1px solid var(--border)", boxShadow: "none", margin: 0 } as React.CSSProperties}>
      <legend className="label" style={{ padding: "0 6px" }}>{title}</legend>

      <div className="field">
        <span className="label">Bought on a</span>
        <div className="tabs" role="radiogroup" aria-label="Purchase bill type" style={{ flexWrap: "wrap" }}>
          {PURCHASE_TYPES.slice().reverse().map((t) => (
            <button type="button" key={t} className="tab" role="radio" aria-checked={value.billType === t} data-active={value.billType === t} style={{ border: 0, cursor: "pointer" }} onClick={() => set({ billType: t, existingId: "" })}>
              {TYPE_TEXT[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="tabs" role="radiogroup" aria-label="New or earlier bill" style={{ alignSelf: "flex-start" }}>
        <button type="button" className="tab" role="radio" aria-checked={value.mode === "new"} data-active={value.mode === "new"} style={{ border: 0, cursor: "pointer" }} onClick={() => set({ mode: "new" })}>New bill</button>
        <button type="button" className="tab" role="radio" aria-checked={value.mode === "existing"} data-active={value.mode === "existing"} style={{ border: 0, cursor: "pointer" }} onClick={() => set({ mode: "existing" })}>Bill entered earlier</button>
      </div>

      {value.mode === "existing" ? (
        <div className="field">
          <label className="label" htmlFor="pb-existing">Same bill as</label>
          {!recent ? (
            <span className="spinner" />
          ) : (
            <select
              id="pb-existing"
              className="select"
              value={value.existingId}
              onChange={(e) => {
                const b = recent.find((x) => x.id === e.target.value);
                set({ existingId: e.target.value, ...(b && { billType: b.billType }) });
              }}
            >
              <option value="">Choose a bill</option>
              {recent.filter((b) => b.billType === value.billType).map((b) => (
                <option key={b.id} value={b.id}>{label(b)}{b.amount ? ` · ${formatINR(b.amount)}` : ""}</option>
              ))}
            </select>
          )}
          {recent && recent.filter((b) => b.billType === value.billType).length === 0 && <span className="hint">No {TYPE_TEXT[value.billType]} purchase bill entered yet.</span>}
        </div>
      ) : (
        <>
          <div className="grid-2">
            <div className="field">
              <label className="label" htmlFor="pb-supplier">Supplier</label>
              <input id="pb-supplier" className="input" value={value.supplier} onChange={(e) => set({ supplier: e.target.value })} maxLength={120} placeholder="Sharma Electronics" />
            </div>
            <div className="field">
              <label className="label" htmlFor="pb-no">Bill no.</label>
              <input id="pb-no" className="input mono" value={value.billNo} onChange={(e) => set({ billNo: e.target.value })} maxLength={60} placeholder="1234" />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label className="label" htmlFor="pb-date">Bill date</label>
              <input id="pb-date" type="date" className="input" value={value.billDate} onChange={(e) => set({ billDate: e.target.value })} />
            </div>
            <div className="field">
              <label className="label" htmlFor="pb-amount">Bill total (₹) <span className="muted">(optional)</span></label>
              <input id="pb-amount" type="number" min="0" step="0.01" className="input" value={value.amount} onChange={(e) => set({ amount: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <span className="label">Photo or PDF of the bill</span>
            <div className="row wrap" style={{ "--gap": "8px" } as React.CSSProperties}>
              <button type="button" className="btn btn-sm" onClick={() => camera.current?.click()}><Camera /> Take photo</button>
              <button type="button" className="btn btn-sm" onClick={() => picker.current?.click()}><Paperclip /> Attach file</button>
              <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={picker} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </div>
            {value.files.length > 0 && (
              <div className="stack" style={{ "--gap": "4px" } as React.CSSProperties}>
                {value.files.map((f, i) => (
                  <span key={i} className="row" style={{ "--gap": "6px", fontSize: 13.5 } as React.CSSProperties}>
                    <FileText style={{ width: 15 }} />
                    <span className="grow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <span className="muted">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button type="button" className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => set({ files: value.files.filter((_, j) => j !== i) })}><X /></button>
                  </span>
                ))}
              </div>
            )}
            <span className="hint">Kept safely with the stock record. Leave everything empty to skip.</span>
          </div>
        </>
      )}
    </fieldset>
  );
}
