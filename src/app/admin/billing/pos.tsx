"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Barcode, LayoutList, Building2, FileText, Minus, PackagePlus, Pencil, Phone, Plus, ReceiptText, ShoppingCart, Trash2, Truck, User, UserX } from "lucide-react";
import { useToast } from "@/components/providers";
import { beep, useBarcodeScanner } from "@/components/barcode";
import { ProductFormDialog } from "@/components/product-form";
import { billTotals, lineAmounts } from "@/lib/store/billing";
import { PAYMENT_LABEL, PAYMENT_MODES, formatINR, toPaise, toRupees, type PaymentMode } from "@/lib/store/money";
import type { ProductDTO } from "@/lib/store/products";
import type { BillSettingsDTO } from "@/lib/store/bill-settings";
import { DETAIL_FIELDS, STATES, stateByCode, stateFromGstin, type BillType, type DetailKey } from "@/lib/store/bill-format";
import { BillSettingsForm } from "@/components/bill-settings-form";
import { ProductPicker } from "./product-picker";

type Line = { key: string; product: ProductDTO; qty: number; unitPrice: number; discount: number };
type CustomerHit = { id: string; name: string; phone: string; email: string; address: string; gstin: string; stateName: string; stateCode: string };
const EMPTY_CUSTOMER = { name: "", phone: "", email: "", address: "", gstin: "", stateName: "", stateCode: "" };
const EMPTY_CONSIGNEE = { name: "", address: "", gstin: "", stateName: "", stateCode: "", phone: "" };

/** State dropdown; picking a state also fills its GST code. */
function StateSelect({ id, code, onChange }: { id: string; code: string; onChange: (code: string, name: string) => void }) {
  return (
    <select id={id} className="select" value={code} onChange={(e) => onChange(e.target.value, stateByCode(e.target.value)?.name ?? "")}>
      <option value="">Select state</option>
      {STATES.map((st) => <option key={st.code} value={st.code}>{st.name} ({st.code})</option>)}
    </select>
  );
}

export type StartCustomer = typeof EMPTY_CUSTOMER;

export function PointOfSale({ categories, billSettings, startCustomer }: { categories: string[]; billSettings: BillSettingsDTO; startCustomer?: StartCustomer | null }) {
  const router = useRouter();
  const toast = useToast();
  const scanRef = useRef<HTMLInputElement>(null);

  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductDTO[]>([]);
  const [looking, setLooking] = useState(false);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ barcode: string } | null>(null);

  const [walkIn, setWalkIn] = useState(false);
  const [customer, setCustomer] = useState(startCustomer ?? EMPTY_CUSTOMER);
  const [customerHits, setCustomerHits] = useState<CustomerHit[]>([]);
  const [returning, setReturning] = useState(!!startCustomer);
  const [picking, setPicking] = useState(false);
  const [payment, setPayment] = useState<PaymentMode>("CASH");
  const [notes, setNotes] = useState("");
  const [shipElsewhere, setShipElsewhere] = useState(false);
  const [consignee, setConsignee] = useState(EMPTY_CONSIGNEE);
  const [details, setDetails] = useState<Partial<Record<DetailKey, string>>>({});
  const [settings, setSettings] = useState(billSettings);
  const [editingSettings, setEditingSettings] = useState(false);
  const seller = settings.seller;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => billTotals(lines.map((l) => ({ ...l, gstRate: l.product.gstRate }))), [lines]);

  function addProduct(p: ProductDTO, qty = 1) {
    setLines((all) => {
      const same = all.find((l) => l.product.id === p.id && l.unitPrice === p.price);
      if (same) return all.map((l) => (l === same ? { ...l, qty: l.qty + qty } : l));
      return [...all, { key: `${p.id}-${Date.now()}-${Math.random()}`, product: p, qty, unitPrice: p.price, discount: 0 }];
    });
    setQuery("");
    setHits([]);
    setUnknownCode(null);
    setError("");
    beep(true);
    scanRef.current?.focus();
  }

  async function addByCode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    setLooking(true);
    const res = await fetch(`/api/products/lookup?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    setLooking(false);
    if (res.ok) return addProduct((await res.json()).product);
    // Not a barcode: fall back to a name search, and add it straight away if only one product matches.
    const found = await fetch(`/api/products?q=${encodeURIComponent(code)}`).then((r) => (r.ok ? r.json() : { items: [] }));
    if (found.items.length === 1) return addProduct(found.items[0]);
    setHits(found.items);
    beep(false);
    if (found.items.length === 0) setUnknownCode(code);
  }

  // Scans that happen while focus is somewhere else (customer fields excepted) still land in the bill.
  useBarcodeScanner((code) => !adding && !picking && addByCode(code));

  // Live search for manual entry.
  useEffect(() => {
    const q = query.trim();
    setUnknownCode(null);
    if (q.length < 2) return setHits([]);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/products?q=${encodeURIComponent(q)}`);
      if (res.ok) setHits((await res.json()).items);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Returning customer lookup by phone.
  useEffect(() => {
    const digits = customer.phone.replace(/\D/g, "");
    if (digits.length < 4 || returning) return setCustomerHits([]);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(digits)}`);
      if (res.ok) setCustomerHits((await res.json()).items);
    }, 250);
    return () => clearTimeout(t);
  }, [customer.phone, returning]);

  const update = (key: string, patch: Partial<Line>) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((all) => all.filter((l) => l.key !== key));
  const setField = (f: keyof typeof EMPTY_CUSTOMER) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (f === "phone") setReturning(false);
    const value = f === "gstin" ? e.target.value.toUpperCase() : e.target.value;
    setCustomer((c) => {
      const next = { ...c, [f]: value };
      // A GSTIN starts with the state code, so fill the state from it.
      const st = f === "gstin" ? stateFromGstin(value) : undefined;
      return st && !c.stateCode ? { ...next, stateCode: st.code, stateName: st.name } : next;
    });
  };

  async function generateBill(billType: BillType) {
    setError("");
    if (lines.length === 0) return setError("Scan or add at least one product.");
    if (billType === "GST" && !seller.gstin) {
      setEditingSettings(true);
      return setError("Add your company's GSTIN first (Edit details), then make the GST Bill.");
    }
    if (shipElsewhere && !consignee.name.trim()) return setError("Enter the consignee's name, or untick Ship to a different address.");
    if (!walkIn && (!customer.name.trim() || customer.phone.replace(/\D/g, "").length < 10)) return setError("Enter the customer's name and 10 digit phone, or tick Walk-in.");
    setBusy(true);
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: walkIn ? null : customer,
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty, unitPrice: toRupees(l.unitPrice), discount: toRupees(l.discount) })),
        paymentMode: payment,
        notes,
        billType,
        consignee: shipElsewhere ? consignee : null,
        details,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Couldn't save the bill");
    }
    toast({ kind: "success", title: "Bill saved", body: "Stock has been updated." });
    router.push(`/admin/sales/${data.id}?new=1`);
  }

  return (
    <div className="pos">
      <div className="stack" style={{ minWidth: 0 }}>
        <section className="card stack">
          <div className="row between">
            <span className="card-title">Scan products</span>
            <span className="hint row" style={{ "--gap": "6px" } as React.CSSProperties}><span className="live-dot" /> Scanner ready</span>
          </div>
          <form
            className="input-wrap"
            onSubmit={(e) => {
              e.preventDefault();
              addByCode(query);
            }}
          >
            <Barcode className="icon-left" />
            <input
              ref={scanRef}
              className="input mono scan-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder="Scan a barcode, or type a name / SKU and press Enter"
              aria-label="Scan barcode or search products"
            />
            {looking && <span className="spinner" style={{ position: "absolute", right: 16, top: 16 }} />}
          </form>

          {hits.length > 0 && (
            <div className="list" style={{ maxHeight: 280, overflowY: "auto" }}>
              {hits.map((p) => (
                <button key={p.id} type="button" className="list-row pick-row" onClick={() => addProduct(p)}>
                  <div className="stack" style={{ "--gap": "2px", minWidth: 0 } as React.CSSProperties}>
                    <span className="row-title">{p.name}</span>
                    <span className="row-sub mono">{p.barcode || p.sku} · {p.category}</span>
                  </div>
                  <span className={`badge ${p.stock <= 0 ? "badge-REWORK" : p.stock <= p.lowStockAt ? "badge-SUBMITTED" : "badge-COMPLETED"}`}>{p.stock} in stock</span>
                  <span style={{ fontWeight: 750 }}>{formatINR(p.price)}</span>
                </button>
              ))}
            </div>
          )}

          {unknownCode && (
            <div className="alert alert-info between">
              <span><AlertCircle style={{ verticalAlign: "-4px" }} /> No product matches <b className="mono">{unknownCode}</b>.</span>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setAdding({ barcode: /^[\w-]{4,}$/.test(unknownCode) && /\d/.test(unknownCode) ? unknownCode : "" })}>
                <PackagePlus /> Add it to the catalog
              </button>
            </div>
          )}
          <div className="row wrap" style={{ "--gap": "8px" } as React.CSSProperties}>
            <button type="button" className="btn btn-sm" onClick={() => setPicking(true)}><LayoutList /> Choose from product list</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAdding({ barcode: "" })}><PackagePlus /> New product without barcode</button>
          </div>
        </section>

        <section className="card stack" style={{ padding: 0, overflow: "hidden" }}>
          <div className="row between" style={{ padding: "18px 22px 0" }}>
            <span className="card-title">Bill items</span>
            <span className="muted" style={{ fontSize: 13, fontWeight: 650 }}>{totals.items} unit{totals.items === 1 ? "" : "s"}</span>
          </div>
          {lines.length === 0 ? (
            <div className="empty" style={{ paddingTop: 30 }}>
              <div className="empty-icon"><ShoppingCart /></div>
              Scan a product's barcode to start the bill.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Product</th><th style={{ width: 120 }}>Qty</th><th style={{ width: 120 }}>Price ₹</th><th style={{ width: 110 }}>Discount ₹</th><th className="num">Amount</th><th /></tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const a = lineAmounts({ ...l, gstRate: l.product.gstRate });
                    const short = l.qty > l.product.stock;
                    return (
                      <tr key={l.key}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{l.product.name}</div>
                          <div className="row-sub mono">{l.product.barcode || l.product.sku} · MRP {formatINR(l.product.mrp)} · GST {l.product.gstRate}%</div>
                          {short && <div className="error-text">Only {l.product.stock} in stock</div>}
                        </td>
                        <td>
                          <div className="qty">
                            <button type="button" aria-label="Less" onClick={() => (l.qty > 1 ? update(l.key, { qty: l.qty - 1 }) : remove(l.key))}><Minus /></button>
                            <input type="number" min={1} value={l.qty} onChange={(e) => update(l.key, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} aria-label="Quantity" />
                            <button type="button" aria-label="More" onClick={() => update(l.key, { qty: l.qty + 1 })}><Plus /></button>
                          </div>
                        </td>
                        <td><input className="input input-sm" type="number" min={0} step="0.01" defaultValue={toRupees(l.unitPrice)} onChange={(e) => update(l.key, { unitPrice: toPaise(Math.max(0, Number(e.target.value) || 0)) })} aria-label="Unit price" /></td>
                        <td><input className="input input-sm" type="number" min={0} step="0.01" defaultValue={toRupees(l.discount) || ""} placeholder="0" onChange={(e) => update(l.key, { discount: toPaise(Math.max(0, Number(e.target.value) || 0)) })} aria-label="Discount" /></td>
                        <td className="num" style={{ fontWeight: 750 }}>{formatINR(a.total)}</td>
                        <td><button type="button" className="icon-btn" aria-label="Remove" onClick={() => remove(l.key)}><Trash2 /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="stack pos-side">
        <section className="card stack">
          <div className="row between">
            <span className="card-title">Customer</span>
            <label className="row hint" style={{ "--gap": "6px", cursor: "pointer" } as React.CSSProperties}>
              <input type="checkbox" checked={walkIn} onChange={(e) => setWalkIn(e.target.checked)} /> Walk-in, no details
            </label>
          </div>
          {walkIn ? (
            <div className="alert alert-info"><UserX /> The bill will say "Walk-in customer" and won't appear in any customer's history.</div>
          ) : (
            <>
              <div className="field" style={{ position: "relative" }}>
                <label className="label" htmlFor="c-phone">Phone</label>
                <div className="input-wrap"><Phone className="icon-left" /><input id="c-phone" className="input" type="tel" value={customer.phone} onChange={setField("phone")} placeholder="98765 43210" autoComplete="off" /></div>
                {customerHits.length > 0 && (
                  <div className="popover suggest">
                    {customerHits.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          setCustomer({ name: c.name, phone: c.phone, email: c.email, address: c.address, gstin: c.gstin, stateName: c.stateName ?? "", stateCode: c.stateCode ?? "" });
                          setReturning(true);
                          setCustomerHits([]);
                        }}
                      >
                        <b>{c.name}</b> <span className="muted mono">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {returning && <span className="hint" style={{ color: "var(--green)" }}>Returning customer, details filled in.</span>}
              </div>
              <div className="field">
                <label className="label" htmlFor="c-name">Name</label>
                <div className="input-wrap"><User className="icon-left" /><input id="c-name" className="input" value={customer.name} onChange={setField("name")} placeholder="Rohan Mehta" /></div>
              </div>
              <div className="field">
                <label className="label" htmlFor="c-address">Address <span className="muted">(optional)</span></label>
                <input id="c-address" className="input" value={customer.address} onChange={setField("address")} placeholder="Sector 12, Noida" />
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field"><label className="label" htmlFor="c-email">Email</label><input id="c-email" className="input" type="email" value={customer.email} onChange={setField("email")} /></div>
                <div className="field"><label className="label" htmlFor="c-gstin">GSTIN/UIN</label><input id="c-gstin" className="input mono" value={customer.gstin} onChange={setField("gstin")} maxLength={15} placeholder="For B2B bills" /></div>
              </div>
              <div className="field">
                <label className="label" htmlFor="c-state">State <span className="muted">(for GST: same state = CGST + SGST, other state = IGST)</span></label>
                <StateSelect id="c-state" code={customer.stateCode} onChange={(code, name) => setCustomer((c) => ({ ...c, stateCode: code, stateName: name }))} />
              </div>
            </>
          )}
        </section>

        <details className="card stack bill-extra">
          <summary className="row between">
            <span className="card-title row" style={{ "--gap": "8px" } as React.CSSProperties}><Truck style={{ width: 18 }} /> Shipping & order details</span>
            <span className="hint">optional, for GST Bill</span>
          </summary>
          <label className="row hint" style={{ "--gap": "8px", cursor: "pointer", marginTop: 14 } as React.CSSProperties}>
            <input type="checkbox" checked={shipElsewhere} onChange={(e) => setShipElsewhere(e.target.checked)} /> Ship to a different address (Consignee)
          </label>
          {shipElsewhere && (
            <div className="stack" style={{ "--gap": "10px", marginTop: 10 } as React.CSSProperties}>
              <input className="input" placeholder="Consignee name" value={consignee.name} onChange={(e) => setConsignee((c) => ({ ...c, name: e.target.value }))} />
              <input className="input" placeholder="Ship-to address" value={consignee.address} onChange={(e) => setConsignee((c) => ({ ...c, address: e.target.value }))} />
              <div className="grid-2" style={{ gap: 10 }}>
                <input
                  className="input mono"
                  placeholder="GSTIN/UIN"
                  maxLength={15}
                  value={consignee.gstin}
                  onChange={(e) => {
                    const gstin = e.target.value.toUpperCase();
                    const st = stateFromGstin(gstin);
                    setConsignee((c) => ({ ...c, gstin, ...(st && !c.stateCode ? { stateCode: st.code, stateName: st.name } : {}) }));
                  }}
                />
                <StateSelect id="cn-state" code={consignee.stateCode} onChange={(code, name) => setConsignee((c) => ({ ...c, stateCode: code, stateName: name }))} />
              </div>
            </div>
          )}
          <div className="grid-2" style={{ gap: 10, marginTop: 14 }}>
            {DETAIL_FIELDS.map((f) => (
              <div className="field" key={f.key} style={{ gap: 4 }}>
                <label className="label" style={{ fontSize: 12 }} htmlFor={`d-${f.key}`}>{f.key === "buyerOrderDate" ? "Buyer's Order Dated" : f.label}</label>
                <input
                  id={`d-${f.key}`}
                  className="input input-sm"
                  type={/Date$/.test(f.key) ? "date" : "text"}
                  value={details[f.key] ?? ""}
                  onChange={(e) => setDetails((d) => ({ ...d, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </details>

        <section className="card stack">
          <div className="seller-strip">
            <Building2 style={{ width: 18, flex: "none", color: "var(--accent)" }} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 750, fontSize: 14 }}>{seller.companyName}</div>
              <div className="row-sub">{seller.gstin ? `GSTIN ${seller.gstin}` : "No GSTIN yet"}{seller.stateName && ` · ${seller.stateName}`}</div>
            </div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditingSettings(true)}><Pencil /> Edit details</button>
          </div>
          <span className="card-title">Payment</span>
          <div className="tabs" role="radiogroup" style={{ flexWrap: "wrap" }}>
            {PAYMENT_MODES.map((m) => (
              <button type="button" key={m} role="radio" aria-checked={payment === m} className="tab" data-active={payment === m} onClick={() => setPayment(m)} style={{ border: 0, cursor: "pointer" }}>
                {PAYMENT_LABEL[m].replace(" (pay later)", "")}
              </button>
            ))}
          </div>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note on the bill (optional), e.g. UPI ref no." maxLength={500} />

          <dl className="totals">
            <dt>Items total</dt><dd>{formatINR(totals.gross)}</dd>
            {totals.discount > 0 && <><dt>Discount</dt><dd>− {formatINR(totals.discount)}</dd></>}
            <dt>Taxable value</dt><dd>{formatINR(totals.taxable)}</dd>
            <dt>GST (incl.)</dt><dd>{formatINR(totals.tax)}</dd>
            {totals.roundOff !== 0 && <><dt>Round off</dt><dd>{totals.roundOff > 0 ? "+" : "−"} {formatINR(Math.abs(totals.roundOff))}</dd></>}
            <dt className="grand">Total</dt><dd className="grand">{formatINR(totals.grandTotal)}</dd>
          </dl>
          {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
          <div className="bill-buttons">
            <button type="button" className="btn btn-lg" disabled={busy || lines.length === 0} onClick={() => generateBill("PLAIN")} title="Prices only, no GST or licence details">
              {busy ? <span className="spinner" /> : <><ReceiptText /> Bill</>}
            </button>
            <button type="button" className="btn btn-primary btn-lg" disabled={busy || lines.length === 0} onClick={() => generateBill("GST")} title="Tax invoice with GSTIN, HSN and GST breakdown">
              {busy ? <span className="spinner" /> : <><FileText /> GST Bill</>}
            </button>
          </div>
          <span className="hint" style={{ textAlign: "center" }}>Bill: prices only. GST Bill: tax invoice with GSTIN, HSN and GST.</span>
          {lines.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.confirm("Clear all items from this bill?") && setLines([])}>
              Clear bill
            </button>
          )}
        </section>
      </div>

      {editingSettings && (
        <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && setEditingSettings(false)}>
          <div className="dialog" style={{ width: "min(760px, 100%)", maxHeight: "calc(100dvh - 32px)", overflowY: "auto" }}>
            <h3 className="display" style={{ fontSize: 26, marginBottom: 16 }}>Bill details</h3>
            <BillSettingsForm
              initial={settings}
              onCancel={() => setEditingSettings(false)}
              onSaved={(next) => {
                setSettings(next);
                setEditingSettings(false);
                toast({ kind: "success", title: "Bill details saved", body: "They'll be printed on new bills." });
              }}
            />
          </div>
        </div>
      )}

      {picking && (
        <ProductPicker
          inBill={lines.reduce<Record<string, number>>((m, l) => ({ ...m, [l.product.id]: (m[l.product.id] ?? 0) + l.qty }), {})}
          onClose={() => setPicking(false)}
          onAdd={(picks) => {
            for (const { product, qty } of picks) addProduct(product, qty);
            setPicking(false);
            toast({ kind: "success", title: `${picks.length} product${picks.length > 1 ? "s" : ""} added to the bill` });
          }}
        />
      )}

      {adding && (
        <ProductFormDialog
          fromBilling
          barcode={adding.barcode}
          categories={categories}
          onClose={() => {
            setAdding(null);
            scanRef.current?.focus();
          }}
          onSaved={(p) => {
            setAdding(null);
            toast({ kind: "success", title: "Product added to the catalog" });
            if (p && p.stock > 0) addProduct(p, p.stock);
            else if (p) toast({ kind: "info", title: "Add stock to sell it", body: "It was saved with zero stock." });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
