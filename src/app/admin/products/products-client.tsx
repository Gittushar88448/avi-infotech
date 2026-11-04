"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, PackagePlus, PackageX, Pencil, PackageCheck, Plus } from "lucide-react";
import { useToast } from "@/components/providers";
import { useBarcodeScanner } from "@/components/barcode";
import { ProductFormDialog } from "@/components/product-form";
import { ActionButton } from "@/components/action-button";
import type { ProductDTO } from "@/lib/store/products";

export function AddProduct({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState<{ barcode: string } | null>(null);
  const router = useRouter();
  const toast = useToast();
  // Scanning a box on this page opens the form with its barcode filled in.
  useBarcodeScanner((code) => !open && setOpen({ barcode: code }));
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen({ barcode: "" })}><Plus /> Add product</button>
      {open && (
        <ProductFormDialog
          barcode={open.barcode}
          categories={categories}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            toast({ kind: "success", title: "Product added" });
            router.refresh();
          }}
        />
      )}
    </>
  );
}

export function EditProduct({ product, categories }: { product: ProductDTO; categories: string[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}><Pencil /> Edit</button>
      {open && (
        <ProductFormDialog
          product={product}
          categories={categories}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            toast({ kind: "success", title: "Product updated" });
            router.refresh();
          }}
        />
      )}
    </>
  );
}

const REASONS = [
  { v: "RESTOCK", l: "Restock", sign: 1, hint: "New stock arrived from the supplier." },
  { v: "RETURN", l: "Customer return", sign: 1, hint: "An item came back in sellable condition." },
  { v: "DAMAGED", l: "Damaged / lost", sign: -1, hint: "Removed from stock and written off." },
  { v: "ADJUSTMENT", l: "Correction", sign: 0, hint: "Fix the count after a stock check. Use a minus sign to reduce." },
] as const;

export function StockButton({ id, name, stock, unit, className = "btn btn-sm" }: { id: string; name: string; stock: number; unit: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>(REASONS[0]);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const n = Math.trunc(Number(qty) || 0);
  const change = reason.sign === 0 ? n : reason.sign * Math.abs(n);

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/products/${id}/stock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ change, reason: reason.v, note }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't update stock");
    toast({ kind: "success", title: "Stock updated", body: `${name}: ${data.stock} ${unit} in stock` });
    setOpen(false);
    setQty("");
    setNote("");
    router.refresh();
  }

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}><PackageCheck /> Stock</button>
      {open && (
        <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="dialog stack">
            <div className="stack" style={{ "--gap": "4px" } as React.CSSProperties}>
              <h3 className="display" style={{ fontSize: 24 }}>Update stock</h3>
              <span className="text-2">{name} · <b>{stock}</b> {unit} now</span>
            </div>
            <div className="tabs" role="radiogroup" style={{ flexWrap: "wrap" }}>
              {REASONS.map((r) => (
                <button type="button" key={r.v} className="tab" role="radio" aria-checked={reason.v === r.v} data-active={reason.v === r.v} style={{ border: 0, cursor: "pointer" }} onClick={() => setReason(r)}>{r.l}</button>
              ))}
            </div>
            <span className="hint">{reason.hint}</span>
            <div className="field">
              <label className="label" htmlFor="s-qty">Quantity</label>
              <input id="s-qty" className="input" type="number" step="1" min={reason.sign === 0 ? undefined : 1} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label className="label" htmlFor="s-note">Note <span className="muted">(supplier, invoice no., reason)</span></label>
              <input id="s-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </div>
            {change !== 0 && <div className="alert alert-info">Stock will go from {stock} to <b>{stock + change}</b>.</div>}
            {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy || change === 0}>{busy ? <span className="spinner" /> : <><PackagePlus /> Save</>}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ToggleActive({ id, name, active }: { id: string; name: string; active: boolean }) {
  return (
    <ActionButton
      url={`/api/products/${id}`}
      method="PATCH"
      body={{ active: !active }}
      className="btn btn-sm btn-ghost"
      confirm={active ? `Hide ${name}? It won't show up in billing or the catalog. Past bills keep it.` : undefined}
      success={active ? "Product hidden" : "Product restored"}
    >
      {active ? <><PackageX /> Hide</> : <><PackageCheck /> Restore</>}
    </ActionButton>
  );
}
