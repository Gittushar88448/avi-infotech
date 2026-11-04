"use client";

import { useState } from "react";
import { AlertCircle, Barcode, IndianRupee, Save } from "lucide-react";
import { GST_RATES, toRupees } from "@/lib/store/money";
import type { ProductDTO } from "@/lib/store/products";

const UNITS = ["pcs", "set", "box", "roll", "m", "kit"];

/**
 * Add / edit product dialog. Used from the catalog and from the billing screen when a scanned
 * barcode isn't in the catalog yet. Leave the barcode empty for items that don't have one:
 * they get an AVI-xxxxx SKU you can search or print.
 */
export function ProductFormDialog({
  product,
  barcode = "",
  categories,
  onClose,
  onSaved,
  fromBilling = false,
}: {
  /** Opened from the billing screen: the stock field is called Quantity there. */
  fromBilling?: boolean;
  product?: ProductDTO;
  barcode?: string;
  categories: string[];
  onClose: () => void;
  onSaved: (product: ProductDTO | null) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = !!product;
  const r = (p?: number) => (p === undefined ? "" : String(toRupees(p)));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(editing ? `/api/products/${product.id}` : "/api/products", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't save the product");
    onSaved(data.product ?? null);
  }

  // A scanner ends with Enter. In the barcode box that should move on, not submit the form.
  const nextOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    (e.currentTarget.form?.elements.namedItem("name") as HTMLInputElement | null)?.focus();
  };

  return (
    <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog stack" style={{ width: "min(720px, 100%)", maxHeight: "calc(100dvh - 32px)", overflowY: "auto" }} onSubmit={onSubmit}>
        <h3 className="display" style={{ fontSize: 26 }}>{editing ? "Edit product" : "Add a product"}</h3>
        {error && <div className="alert alert-error"><AlertCircle />{error}</div>}

        <div className="grid-2">
          <div className="field">
            <label className="label" htmlFor="p-barcode">Barcode <span className="muted">(scan, or leave empty)</span></label>
            <div className="input-wrap">
              <Barcode className="icon-left" />
              <input id="p-barcode" name="barcode" className="input mono" defaultValue={product?.barcode ?? barcode} onKeyDown={nextOnEnter} autoFocus={!barcode && !editing} placeholder="Scan the box" autoComplete="off" />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="p-category">Category</label>
            <input id="p-category" name="categoryName" className="input" list="p-categories" required defaultValue={product?.category} placeholder="CCTV camera, DVR, Cable..." />
            <datalist id="p-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="p-name">Product name</label>
          <input id="p-name" name="name" className="input" required maxLength={160} defaultValue={product?.name} autoFocus={!!barcode} placeholder="Hikvision 2MP Dome Camera" />
        </div>
        <div className="grid-3">
          <div className="field"><label className="label" htmlFor="p-brand">Brand</label><input id="p-brand" name="brand" className="input" defaultValue={product?.brand} placeholder="Hikvision" /></div>
          <div className="field"><label className="label" htmlFor="p-model">Model</label><input id="p-model" name="model" className="input" defaultValue={product?.model} placeholder="DS-2CE76D0T" /></div>
          <div className="field"><label className="label" htmlFor="p-hsn">HSN code</label><input id="p-hsn" name="hsn" className="input mono" defaultValue={product?.hsn} placeholder="8525" /></div>
        </div>
        <div className="grid-3">
          <div className="field">
            <label className="label" htmlFor="p-mrp">MRP (₹)</label>
            <div className="input-wrap"><IndianRupee className="icon-left" /><input id="p-mrp" name="mrp" type="number" min="0" step="0.01" className="input" required defaultValue={r(product?.mrp)} /></div>
          </div>
          <div className="field">
            <label className="label" htmlFor="p-price">Selling price (₹)</label>
            <div className="input-wrap"><IndianRupee className="icon-left" /><input id="p-price" name="price" type="number" min="0" step="0.01" className="input" defaultValue={r(product?.price)} placeholder="Same as MRP" /></div>
          </div>
          <div className="field">
            <label className="label" htmlFor="p-cost">Cost price (₹) <span className="muted">(private)</span></label>
            <div className="input-wrap"><IndianRupee className="icon-left" /><input id="p-cost" name="costPrice" type="number" min="0" step="0.01" className="input" defaultValue={r(product?.costPrice)} /></div>
          </div>
        </div>
        <div className="grid-3">
          <div className="field">
            <label className="label" htmlFor="p-gst">GST (included in price)</label>
            <select id="p-gst" name="gstRate" className="select" defaultValue={product?.gstRate ?? 18}>
              {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="p-warranty">Warranty (months)</label>
            <input id="p-warranty" name="warrantyMonths" type="number" min="0" step="1" className="input" defaultValue={product?.warrantyMonths ?? 0} />
          </div>
          <div className="field">
            <label className="label" htmlFor="p-unit">Unit</label>
            <select id="p-unit" name="unit" className="select" defaultValue={product?.unit ?? "pcs"}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          {!editing && (
            <div className="field">
              <label className="label" htmlFor="p-stock">{fromBilling ? "Quantity" : "Opening stock"}</label>
              <input id="p-stock" name="openingStock" type="number" min={fromBilling ? 1 : 0} step="1" className="input" defaultValue={fromBilling || barcode ? 1 : 0} />
              <span className="hint">{fromBilling ? "How many you have. This quantity is added to the bill." : "Later changes go through Restock so they're recorded."}</span>
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="p-low">Low stock alert at</label>
            <input id="p-low" name="lowStockAt" type="number" min="0" step="1" className="input" defaultValue={product?.lowStockAt ?? 3} />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="p-desc">Notes <span className="muted">(optional)</span></label>
          <textarea id="p-desc" name="description" className="textarea" style={{ minHeight: 70 }} defaultValue={product?.description} placeholder="Specs, supplier, shelf location..." />
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : <><Save /> {editing ? "Save changes" : "Add product"}</>}</button>
        </div>
      </form>
    </div>
  );
}
