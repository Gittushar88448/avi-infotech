"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Barcode, CheckCircle2, PackagePlus, PackageX, Pencil, PackageCheck, Plus, Trash2, X } from "lucide-react";
import { beep } from "@/components/barcode";
import { PurchaseBadge } from "@/components/store-ui";
import { PURCHASE_LABEL, type PurchaseType } from "@/lib/store/bill-format";
import { PurchaseBillFields, billHasDetails, emptyBill, savePurchaseBill, type BillDraft } from "@/components/purchase-bill-fields";
import { useToast } from "@/components/providers";
import { useBarcodeScanner } from "@/components/barcode";
import { ProductFormDialog } from "@/components/product-form";
import { ActionButton } from "@/components/action-button";
import type { ProductDTO } from "@/lib/store/products";

export function AddProduct({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState<{ barcode: string } | null>(null);
  const router = useRouter();
  const toast = useToast();
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

type Found = { product: ProductDTO; qty: number };
type Done = { key: number; text: string; kind: "new" | "stock" };

/**
 * "Add by barcode": scan box after box. A new barcode opens the product form with the code filled
 * in; a barcode that's already in the catalog offers to add stock (scan it again to count +1).
 * Scanning anywhere on the Products page opens this too.
 */
export function ScanToAdd({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [bill, setBill] = useState<BillDraft>(() => emptyBill("GST"));
  // The session's bill is saved once, on the first stock change, and reused for every box after.
  const [billId, setBillId] = useState<string | null>(null);
  const purchase: PurchaseType = bill.billType;
  async function ensureBill() {
    if (billId) return billId;
    const saved = await savePurchaseBill(bill);
    if (saved.error) throw new Error(saved.error);
    if (saved.id) setBillId(saved.id);
    return saved.id;
  }
  const [done, setDone] = useState<Done[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  const focus = () => setTimeout(() => input.current?.focus(), 30);
  const log = (text: string, kind: Done["kind"]) => setDone((d) => [{ key: Date.now() + Math.random(), text, kind }, ...d].slice(0, 30));

  async function lookup(raw: string) {
    const c = raw.trim();
    setCode("");
    setError("");
    if (!c) return;
    // Same box scanned again: count it.
    if (found && (found.product.barcode === c || found.product.sku === c.toUpperCase())) {
      beep(true);
      return setFound({ ...found, qty: found.qty + 1 });
    }
    if (found) await saveStock(); // a different box: save the previous one first
    const res = await fetch(`/api/products/lookup?code=${encodeURIComponent(c)}`, { cache: "no-store" });
    if (res.ok) {
      beep(true);
      setFound({ product: (await res.json()).product, qty: 1 });
      focus();
    } else if (res.status === 404) {
      beep(false);
      setCreating(c);
    } else setError("Couldn't look up that barcode. Try again.");
  }

  async function saveStock() {
    if (!found) return;
    setBusy(true);
    let purchaseBillId: string | null = null;
    try {
      purchaseBillId = await ensureBill();
    } catch (e) {
      setBusy(false);
      return setError((e as Error).message);
    }
    const res = await fetch(`/api/products/${found.product.id}/stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ change: found.qty, reason: "RESTOCK", note: "Added by barcode scan", purchaseBillId: purchaseBillId ?? "" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't add stock");
    log(`+${found.qty} ${found.product.unit} ${found.product.name} (now ${data.stock})`, "stock");
    setFound(null);
    router.refresh();
    focus();
  }

  // Scanning anywhere on the page opens this dialog with that code.
  useBarcodeScanner((c) => {
    if (creating) return;
    if (!open) setOpen(true);
    lookup(c);
  });

  function close() {
    setOpen(false);
    setFound(null);
    setError("");
    if (done.length) toast({ kind: "success", title: "Products updated", body: `${done.length} change${done.length > 1 ? "s" : ""} saved` });
    setDone([]);
    setBillId(null);
    setBill(emptyBill(bill.billType));
  }

  return (
    <>
      <button className="btn" onClick={() => { setOpen(true); focus(); }}><Barcode /> Add by barcode</button>
      {open && !creating && (
        <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="dialog stack" style={{ width: "min(640px, 100%)" }} role="dialog" aria-label="Add products by barcode">
            <div className="row between">
              <h3 className="display" style={{ fontSize: 24 }}>Add by barcode</h3>
              <button className="icon-btn" aria-label="Close" onClick={close}><X /></button>
            </div>
            <span className="text-2">Scan each box. New barcodes open the product form; known ones add stock. Scan the same box again to count it.</span>

            {billId ? (
              <div className="alert alert-info"><CheckCircle2 /><span>Everything you scan now goes on this <b>{bill.billType === "GST" ? "GST" : "Without GST"} bill</b>{bill.mode === "new" && (bill.supplier || bill.billNo) ? ` (${[bill.supplier, bill.billNo && `bill ${bill.billNo}`].filter(Boolean).join(", ")})` : ""}. <button type="button" className="link-underline" style={{ border: 0, background: "none", padding: 0, color: "inherit", font: "inherit", cursor: "pointer", fontWeight: 700 }} onClick={() => { setBillId(null); setBill(emptyBill(bill.billType)); }}>Start another bill</button></span></div>
            ) : (
              <PurchaseBillFields value={bill} onChange={setBill} title="Purchase bill for these boxes" />
            )}

            <form className="input-wrap" onSubmit={(e) => { e.preventDefault(); lookup(code); }}>
              <Barcode className="icon-left" />
              <input ref={input} className="input mono scan-input" value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoComplete="off" placeholder="Scan a barcode, or type it and press Enter" aria-label="Barcode" />
            </form>
            {error && <div className="alert alert-error"><AlertCircle />{error}</div>}

            {found && (
              <div className="card stack" style={{ "--gap": "10px", padding: 14 } as React.CSSProperties}>
                <div className="row between wrap">
                  <div className="stack" style={{ "--gap": "2px" } as React.CSSProperties}>
                    <strong>{found.product.name}</strong>
                    <span className="hint mono">{found.product.barcode || found.product.sku} · {found.product.stock} {found.product.unit} in stock</span>
                  </div>
                  <PurchaseBadge type={found.product.purchaseType} long />
                </div>
                {found.product.purchaseType !== purchase && (
                  <div className="alert alert-warn"><AlertCircle /><span>This product is saved as <b>{PURCHASE_LABEL[found.product.purchaseType]}</b>, but this purchase is <b>{purchase === "GST" ? "GST" : "Without GST"}</b>. Edit the product if that has changed.</span></div>
                )}
                <div className="row wrap" style={{ "--gap": "8px" } as React.CSSProperties}>
                  <label className="label" htmlFor="scan-qty" style={{ margin: 0 }}>Add to stock</label>
                  <input id="scan-qty" type="number" min={1} step={1} className="input" style={{ width: 110 }} value={found.qty} onChange={(e) => setFound({ ...found, qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
                  <span className="grow" />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFound(null); focus(); }}>Skip</button>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={saveStock}>{busy ? <span className="spinner" /> : <><PackagePlus /> Add {found.qty}</>}</button>
                </div>
              </div>
            )}

            {done.length > 0 && (
              <div className="stack" style={{ "--gap": "6px", maxHeight: 200, overflowY: "auto" } as React.CSSProperties}>
                <span className="eyebrow">Saved this session</span>
                {done.map((d) => (
                  <span key={d.key} className="row" style={{ "--gap": "8px", fontSize: 14 } as React.CSSProperties}>
                    <CheckCircle2 style={{ width: 16, color: "var(--green)" }} />
                    {d.kind === "new" ? <b>New:</b> : null} {d.text}
                  </span>
                ))}
              </div>
            )}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={close}>Done</button>
            </div>
          </div>
        </div>
      )}
      {creating && (
        <ProductFormDialog
          barcode={creating}
          categories={categories}
          defaultPurchaseType={purchase}
          defaultBill={billId ? { ...bill, mode: "existing", existingId: billId } : billHasDetails(bill) ? bill : undefined}
          onBillSaved={(id) => setBillId(id)}
          onClose={() => { setCreating(null); setOpen(true); focus(); }}
          onSaved={(p) => {
            setCreating(null);
            setOpen(true);
            if (p) log(`${p.name} · ${p.stock} ${p.unit} · ${PURCHASE_LABEL[p.purchaseType]}`, "new");
            router.refresh();
            focus();
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

export function StockButton({ id, name, stock, unit, purchaseType = "GST", className = "btn btn-sm" }: { id: string; name: string; stock: number; unit: string; purchaseType?: PurchaseType; className?: string }) {
  const [bill, setBill] = useState<BillDraft>(() => emptyBill(purchaseType));
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
    let purchaseBillId: string | null = null;
    if (reason.v === "RESTOCK") {
      const saved = await savePurchaseBill(bill);
      if (saved.error) {
        setBusy(false);
        return setError(saved.error);
      }
      purchaseBillId = saved.id;
      // Don't save the same new bill twice if the stock update fails below.
      if (saved.id && bill.mode === "new") setBill({ ...bill, mode: "existing", existingId: saved.id });
    }
    const res = await fetch(`/api/products/${id}/stock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ change, reason: reason.v, note, purchaseBillId: purchaseBillId ?? "" }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't update stock");
    toast({ kind: "success", title: "Stock updated", body: `${name}: ${data.stock} ${unit} in stock` });
    setOpen(false);
    setQty("");
    setNote("");
    setBill(emptyBill(purchaseType));
    router.refresh();
  }

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}><PackageCheck /> Stock</button>
      {open && (
        <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="dialog stack" style={{ width: "min(640px, 100%)", maxHeight: "calc(100dvh - 32px)", overflowY: "auto" }}>
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
              <label className="label" htmlFor="s-note">Note <span className="muted">(optional)</span></label>
              <input id="s-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </div>
            {reason.v === "RESTOCK" && <PurchaseBillFields value={bill} onChange={setBill} title="Supplier's bill (GST or Without GST)" />}
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

export function DeleteProduct({ id, name }: { id: string; name: string }) {
  return (
    <ActionButton
      url={`/api/products/${id}`}
      method="DELETE"
      className="btn btn-sm btn-danger"
      confirm={`Delete ${name}? It will be removed from products, billing and quotations. Bills and quotations already made keep their copy of it. This can't be undone.`}
      success="Product deleted"
      redirectTo="/admin/products"
    >
      <Trash2 /> Delete
    </ActionButton>
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
