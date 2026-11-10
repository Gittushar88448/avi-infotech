"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, ShoppingCart, X } from "lucide-react";
import { formatINR } from "@/lib/store/money";
import type { ProductDTO } from "@/lib/store/products";
import { PurchaseBadge } from "@/components/store-ui";

/**
 * Pick products from the full catalog instead of scanning: search or filter by category,
 * set a quantity on as many products as you like, then add them all to the bill at once.
 */
export function ProductPicker({ inBill, onAdd, onClose, ignoreStock = false, actionLabel = "Add to bill" }: { inBill: Record<string, number>; onAdd: (picks: { product: ProductDTO; qty: number }[]) => void; onClose: () => void; /** Quotations may offer more than is in stock. */ ignoreStock?: boolean; actionLabel?: string }) {
  const [all, setAll] = useState<ProductDTO[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [pt, setPt] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/products?all=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setAll(d.items))
      .catch(() => setError("Couldn't load the product list."));
  }, []);

  const categories = useMemo(() => [...new Set((all ?? []).map((p) => p.category).filter(Boolean))].sort(), [all]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (all ?? []).filter(
      (p) => (!cat || p.category === cat) && (!pt || p.purchaseType === pt) && (!t || [p.name, p.brand, p.model, p.sku, p.barcode].some((v) => v?.toLowerCase().includes(t))),
    );
  }, [all, q, cat, pt]);

  const picked = Object.entries(qty).filter(([, n]) => n > 0);
  const units = picked.reduce((a, [, n]) => a + n, 0);
  const amount = picked.reduce((a, [id, n]) => a + (all?.find((p) => p.id === id)?.price ?? 0) * n, 0);
  // Stock left after what's already on the bill.
  const free = (p: ProductDTO) => (ignoreStock ? 100_000 : Math.max(0, p.stock - (inBill[p.id] ?? 0)));
  const setN = (p: ProductDTO, n: number) => setQty((s) => ({ ...s, [p.id]: Math.max(0, Math.min(free(p), Math.floor(n) || 0)) }));

  return (
    <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog stack picker" role="dialog" aria-label="Choose products">
        <div className="row between">
          <h3 className="display" style={{ fontSize: 24 }}>Choose products</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X /></button>
        </div>
        <div className="row wrap" style={{ "--gap": "8px" } as React.CSSProperties}>
          <div className="input-wrap grow" style={{ minWidth: 200 }}>
            <Search className="icon-left" />
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, brand, model, barcode" autoFocus />
          </div>
          <select className="select" value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 200 }} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="select" value={pt} onChange={(e) => setPt(e.target.value)} style={{ width: 190 }} aria-label="Purchase type">
            <option value="">GST and normal bill</option>
            <option value="GST">GST bill only</option>
            <option value="LOCAL">Normal bill only</option>
          </select>
        </div>

        <div className="picker-list">
          {error ? (
            <div className="alert alert-error">{error}</div>
          ) : !all ? (
            <div className="empty" style={{ padding: 30 }}><span className="spinner" /></div>
          ) : shown.length === 0 ? (
            <div className="empty" style={{ padding: 30 }}>No products match.</div>
          ) : (
            shown.map((p) => {
              const n = qty[p.id] ?? 0;
              const left = free(p);
              return (
                <div key={p.id} className="picker-row" data-picked={n > 0} data-out={left === 0}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ "--gap": "8px", flexWrap: "wrap" } as React.CSSProperties}><span style={{ fontWeight: 650 }}>{p.name}</span><PurchaseBadge type={p.purchaseType} /></div>
                    <div className="row-sub">{p.category}{p.brand && ` · ${p.brand}`} · <span className="mono">{p.barcode || p.sku}</span></div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 96 }}>
                    <div style={{ fontWeight: 700 }}>{formatINR(p.price)}</div>
                    <div className={left === 0 || p.stock <= 0 ? "error-text" : "hint"} style={{ fontSize: 12 }}>{ignoreStock ? (p.stock > 0 ? `${p.stock} in stock` : "Out of stock") : left === 0 ? "Out of stock" : `${left} in stock`}</div>
                  </div>
                  {n === 0 ? (
                    <button type="button" className="btn btn-sm" disabled={left === 0} onClick={() => setN(p, 1)}><Plus /> Add</button>
                  ) : (
                    <div className="qty">
                      <button type="button" aria-label="Less" onClick={() => setN(p, n - 1)}><Minus /></button>
                      <input type="number" min={0} max={left} value={n} onChange={(e) => setN(p, Number(e.target.value))} aria-label={`Quantity of ${p.name}`} />
                      <button type="button" aria-label="More" disabled={n >= left} onClick={() => setN(p, n + 1)}><Plus /></button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="row between wrap">
          <span className="text-2" style={{ fontWeight: 650 }}>{picked.length ? `${picked.length} product${picked.length > 1 ? "s" : ""}, ${units} unit${units > 1 ? "s" : ""} · ${formatINR(amount)}` : "Nothing chosen yet"}</span>
          <div className="row">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!picked.length}
              onClick={() => onAdd(picked.map(([id, n]) => ({ product: all!.find((p) => p.id === id)!, qty: n })))}
            >
              <ShoppingCart /> {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
