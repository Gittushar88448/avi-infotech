"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowDown, ArrowUp, Barcode, CalendarDays, Copy, Eye, FileText, LayoutList, Minus, Percent, Phone, Plus, ReceiptText, Save, Trash2, User, Wrench,
} from "lucide-react";
import { useToast } from "@/components/providers";
import { beep, useBarcodeScanner } from "@/components/barcode";
import { billTotals, lineAmounts } from "@/lib/store/billing";
import { GST_RATES, amountInWords, formatINR, toPaise, toRupees } from "@/lib/store/money";
import { STATES, isInterState, stateByCode, stateFromGstin, type BillType } from "@/lib/store/bill-format";
import type { ProductDTO } from "@/lib/store/products";
import type { QuoteDTO } from "@/lib/store/quotes";
import { ProductPicker } from "../billing/product-picker";

type Line = {
  key: string;
  productId: string;
  name: string;
  description: string;
  hsn: string;
  unit: string;
  qty: number;
  unitPrice: number;
  discount: number;
  gstRate: number;
  mrp: number;
  stock: number | null;
  showDesc: boolean;
};
type CustomerHit = { id: string; name: string; phone: string; email: string; address: string; gstin: string; stateName: string; stateCode: string };
const EMPTY_CUSTOMER = { name: "", phone: "", email: "", address: "", gstin: "", stateName: "", stateCode: "" };
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function fromProduct(p: ProductDTO, qty = 1): Line {
  return { key: uid(), productId: p.id, name: p.name, description: [p.brand, p.model].filter(Boolean).join(" "), hsn: p.hsn, unit: p.unit, qty, unitPrice: p.price, discount: 0, gstRate: p.gstRate, mrp: p.mrp, stock: p.stock, showDesc: false };
}

export function QuoteBuilder({ initial, defaultTerms, sellerStateCode, startCustomer }: { initial?: QuoteDTO; defaultTerms: string; sellerStateCode: string; startCustomer?: typeof EMPTY_CUSTOMER | null }) {
  const router = useRouter();
  const toast = useToast();
  const scanRef = useRef<HTMLInputElement>(null);
  const editing = !!initial;

  const [lines, setLines] = useState<Line[]>(() =>
    (initial?.items ?? []).map((i) => ({ key: uid(), ...i, stock: null, showDesc: !!i.description })),
  );
  const [quoteType, setQuoteType] = useState<BillType>(initial?.quoteType ?? "GST");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [customer, setCustomer] = useState(initial?.customer ?? startCustomer ?? EMPTY_CUSTOMER);
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [customerHits, setCustomerHits] = useState<CustomerHit[]>([]);
  const [validUntil, setValidUntil] = useState(initial?.validUntil ?? plusDays(15));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [terms, setTerms] = useState(initial?.terms ?? defaultTerms);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductDTO[]>([]);
  const [looking, setLooking] = useState(false);
  const [picking, setPicking] = useState(false);
  const [bulkPct, setBulkPct] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const firstRender = useRef(true);

  // Track unsaved changes so a stray click doesn't lose a long quotation.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setDirty(true);
  }, [lines, quoteType, subject, customer, validUntil, notes, terms]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const totals = useMemo(() => billTotals(lines), [lines]);
  const inter = isInterState(sellerStateCode, customer.stateCode || stateFromGstin(customer.gstin)?.code);
  const gst = quoteType === "GST";

  function addProduct(p: ProductDTO, qty = 1) {
    setLines((all) => {
      const same = all.find((l) => l.productId === p.id && l.unitPrice === p.price);
      if (same) return all.map((l) => (l === same ? { ...l, qty: l.qty + qty } : l));
      return [...all, fromProduct(p, qty)];
    });
    setQuery("");
    setHits([]);
    setError("");
    beep(true);
  }

  function addCustom() {
    const key = uid();
    setLines((all) => [...all, { key, productId: "", name: "", description: "", hsn: "", unit: "job", qty: 1, unitPrice: 0, discount: 0, gstRate: 18, mrp: 0, stock: null, showDesc: false }]);
    setTimeout(() => document.getElementById(`name-${key}`)?.focus(), 30);
  }

  async function addByCode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    setLooking(true);
    const res = await fetch(`/api/products/lookup?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    setLooking(false);
    if (res.ok) return addProduct((await res.json()).product);
    const found = await fetch(`/api/products?q=${encodeURIComponent(code)}`).then((r) => (r.ok ? r.json() : { items: [] }));
    if (found.items.length === 1) return addProduct(found.items[0]);
    setHits(found.items);
    beep(false);
    if (!found.items.length) setError(`No product matches "${code}". Use "Custom item" for things that aren't in the catalog.`);
  }
  useBarcodeScanner((code) => !picking && addByCode(code));

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return setHits([]);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/products?q=${encodeURIComponent(q)}`);
      if (res.ok) setHits((await res.json()).items);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const term = customer.phone.replace(/\D/g, "").length >= 4 ? customer.phone.replace(/\D/g, "") : "";
    if (!term || customerId) return setCustomerHits([]);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(term)}`);
      if (res.ok) setCustomerHits((await res.json()).items);
    }, 250);
    return () => clearTimeout(t);
  }, [customer.phone, customerId]);

  const update = (key: string, patch: Partial<Line>) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((all) => all.filter((l) => l.key !== key));
  const move = (key: string, dir: -1 | 1) =>
    setLines((all) => {
      const i = all.findIndex((l) => l.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= all.length) return all;
      const next = [...all];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const duplicate = (key: string) => setLines((all) => all.flatMap((l) => (l.key === key ? [l, { ...l, key: uid() }] : [l])));
  const setCust = (f: keyof typeof EMPTY_CUSTOMER) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = f === "gstin" ? e.target.value.toUpperCase() : e.target.value;
    if (f === "phone" || f === "name") setCustomerId("");
    setCustomer((c) => {
      const next = { ...c, [f]: value };
      const st = f === "gstin" ? stateFromGstin(value) : undefined;
      return st && !c.stateCode ? { ...next, stateCode: st.code, stateName: st.name } : next;
    });
  };
  function applyBulkDiscount() {
    const pct = Math.min(100, Math.max(0, Number(bulkPct) || 0));
    setLines((all) => all.map((l) => ({ ...l, discount: Math.round((l.unitPrice * l.qty * pct) / 100) })));
    toast({ kind: "success", title: pct ? `${pct}% discount applied to every line` : "Discounts cleared" });
  }

  async function save(open: boolean) {
    setError("");
    if (!customer.name.trim()) return setError("Enter the customer's name.");
    if (lines.length === 0) return setError("Add at least one product or custom item.");
    const unnamed = lines.findIndex((l) => !l.name.trim());
    if (unnamed >= 0) return setError(`Line ${unnamed + 1} needs a name.`);
    setBusy(true);
    const body = {
      quoteType,
      subject,
      customer,
      customerId,
      items: lines.map((l) => ({ productId: l.productId, name: l.name, description: l.description, hsn: l.hsn, unit: l.unit, qty: l.qty, unitPrice: toRupees(l.unitPrice), discount: toRupees(l.discount), gstRate: l.gstRate })),
      validUntil,
      notes,
      terms,
    };
    const res = await fetch(editing ? `/api/quotations/${initial!.id}` : "/api/quotations", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't save the quotation");
    setDirty(false);
    toast({ kind: "success", title: editing ? "Quotation updated" : "Quotation saved" });
    if (open) router.push(`/admin/quotations/${data.id}`);
    else if (!editing) router.replace(`/admin/quotations/${data.id}/edit`);
    else router.refresh();
  }

  // Ctrl/Cmd + S saves.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const inQuote = Object.fromEntries(lines.filter((l) => l.productId).map((l) => [l.productId, l.qty]));

  return (
    <div className="pos">
      <div className="stack" style={{ minWidth: 0 }}>
        <section className="card stack">
          <div className="row between wrap">
            <span className="card-title">Add products</span>
            <span className="hint row" style={{ "--gap": "6px" } as React.CSSProperties}><span className="live-dot" /> Scanner ready</span>
          </div>
          <form className="input-wrap" onSubmit={(e) => { e.preventDefault(); addByCode(query); }}>
            <Barcode className="icon-left" />
            <input ref={scanRef} className="input mono scan-input" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={!editing} autoComplete="off" placeholder="Scan a barcode, or type a product name and press Enter" aria-label="Scan or search products" />
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
                  <span className={`badge ${p.stock <= 0 ? "badge-REWORK" : "badge-COMPLETED"}`}>{p.stock} in stock</span>
                  <span style={{ fontWeight: 750 }}>{formatINR(p.price)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="row wrap" style={{ "--gap": "8px" } as React.CSSProperties}>
            <button type="button" className="btn btn-sm" onClick={() => setPicking(true)}><LayoutList /> Choose from product list</button>
            <button type="button" className="btn btn-sm" onClick={addCustom}><Wrench /> Custom item (installation, labour…)</button>
          </div>
        </section>

        <section className="card stack" style={{ padding: 0, overflow: "hidden" }}>
          <div className="row between wrap" style={{ padding: "18px 22px 0" }}>
            <span className="card-title">Quotation items</span>
            {lines.length > 0 && (
              <div className="row" style={{ "--gap": "6px" } as React.CSSProperties}>
                <div className="input-wrap" style={{ width: 120 }}>
                  <Percent className="icon-left" />
                  <input className="input input-sm" style={{ paddingLeft: 34 }} type="number" min={0} max={100} step="0.5" value={bulkPct} onChange={(e) => setBulkPct(e.target.value)} placeholder="Disc %" aria-label="Discount percent for all lines" />
                </div>
                <button type="button" className="btn btn-sm" onClick={applyBulkDiscount}>Apply to all</button>
              </div>
            )}
          </div>
          {lines.length === 0 ? (
            <div className="empty" style={{ padding: 40 }}>
              <div className="empty-icon"><FileText /></div>
              <strong style={{ color: "var(--text)" }}>No items yet</strong>
              <span>Scan a box, choose from the product list, or add a custom item like installation charges.</span>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table quote-lines">
                <thead>
                  <tr>
                    <th style={{ width: 24 }}>#</th>
                    <th>Item</th>
                    <th style={{ width: 104 }}>Qty</th>
                    <th style={{ width: 104 }}>Rate / disc. ₹</th>
                    {gst && <th style={{ width: 78 }}>GST</th>}
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const a = lineAmounts(l);
                    return (
                      <tr key={l.key} className="quote-line">
                        <td className="muted mono">{i + 1}</td>
                        <td style={{ minWidth: 160 }}>
                          {l.productId ? (
                            <div style={{ fontWeight: 700 }}>{l.name}</div>
                          ) : (
                            <input id={`name-${l.key}`} className="input input-sm" value={l.name} onChange={(e) => update(l.key, { name: e.target.value })} placeholder="e.g. Installation & wiring" aria-label="Item name" />
                          )}
                          {l.showDesc ? (
                            <textarea className="textarea" style={{ minHeight: 54, marginTop: 6, fontSize: 13.5 }} value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} placeholder="Description shown on the quotation" />
                          ) : (
                            <button type="button" className="link-btn hint" onClick={() => update(l.key, { showDesc: true })}>{l.description ? l.description : "+ add description"}</button>
                          )}
                          <div className="row-sub mono">
                            {l.productId ? `MRP ${formatINR(l.mrp)}` : "Custom item"}
                            {l.stock !== null && l.qty > l.stock && <span className="error-text"> · only {l.stock} in stock</span>}
                          </div>
                          <div className="row line-tools" style={{ "--gap": "0px", marginTop: 4, marginLeft: -6 } as React.CSSProperties}>
                            <button type="button" className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(l.key, -1)}><ArrowUp /></button>
                            <button type="button" className="icon-btn" title="Move down" disabled={i === lines.length - 1} onClick={() => move(l.key, 1)}><ArrowDown /></button>
                            <button type="button" className="icon-btn" title="Duplicate line" onClick={() => duplicate(l.key)}><Copy /></button>
                            <button type="button" className="icon-btn" title="Remove" onClick={() => remove(l.key)}><Trash2 /></button>
                          </div>
                        </td>
                        <td>
                          <div className="qty">
                            <button type="button" aria-label="Less" onClick={() => (l.qty > 1 ? update(l.key, { qty: l.qty - 1 }) : remove(l.key))}><Minus /></button>
                            <input type="number" min={1} value={l.qty} onChange={(e) => update(l.key, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} aria-label="Quantity" />
                            <button type="button" aria-label="More" onClick={() => update(l.key, { qty: l.qty + 1 })}><Plus /></button>
                          </div>
                          <input className="input input-sm unit-input" value={l.unit} onChange={(e) => update(l.key, { unit: e.target.value.slice(0, 12) })} aria-label="Unit" />
                        </td>
                        <td>
                          <input className="input input-sm" type="number" min={0} step="0.01" value={toRupees(l.unitPrice) || ""} placeholder="0" onChange={(e) => update(l.key, { unitPrice: toPaise(Math.max(0, Number(e.target.value) || 0)) })} aria-label="Rate" title="Rate per unit, GST included" />
                          <label className="disc-input">
                            <span>Disc.</span>
                            <input className="input input-sm" type="number" min={0} step="0.01" value={toRupees(l.discount) || ""} placeholder="0" onChange={(e) => update(l.key, { discount: toPaise(Math.max(0, Number(e.target.value) || 0)) })} aria-label="Discount for this line" title="Discount on this line, in ₹" />
                          </label>
                        </td>
                        {gst && (
                          <td>
                            <select className="select input-sm" value={l.gstRate} onChange={(e) => update(l.key, { gstRate: Number(e.target.value) })} aria-label="GST rate">
                              {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
                            </select>
                          </td>
                        )}
                        <td className="num" style={{ fontWeight: 750 }}>{formatINR(a.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card stack">
          <span className="card-title">Notes & terms</span>
          <div className="field">
            <label className="label" htmlFor="q-notes">Note to the customer <span className="muted">(optional)</span></label>
            <textarea id="q-notes" className="textarea" style={{ minHeight: 70 }} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Delivery in 3 days after confirmation. Installation included." />
          </div>
          <div className="field">
            <label className="label" htmlFor="q-terms">Terms & conditions</label>
            <textarea id="q-terms" className="textarea" style={{ minHeight: 90 }} value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={2000} />
          </div>
        </section>
      </div>

      <div className="stack pos-side">
        <section className="card stack">
          <span className="card-title">Customer</span>
          <div className="field" style={{ position: "relative" }}>
            <label className="label" htmlFor="qc-phone">Phone</label>
            <div className="input-wrap"><Phone className="icon-left" /><input id="qc-phone" className="input" type="tel" value={customer.phone} onChange={setCust("phone")} placeholder="98765 43210" autoComplete="off" /></div>
            {customerHits.length > 0 && (
              <div className="popover suggest">
                {customerHits.map((c) => (
                  <button type="button" key={c.id} onClick={() => { setCustomer({ name: c.name, phone: c.phone, email: c.email, address: c.address, gstin: c.gstin, stateName: c.stateName ?? "", stateCode: c.stateCode ?? "" }); setCustomerId(c.id); setCustomerHits([]); }}>
                    <b>{c.name}</b> <span className="muted mono">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {customerId && <span className="hint" style={{ color: "var(--green)" }}>Existing customer, details filled in.</span>}
          </div>
          <div className="field">
            <label className="label" htmlFor="qc-name">Name / company</label>
            <div className="input-wrap"><User className="icon-left" /><input id="qc-name" className="input" value={customer.name} onChange={setCust("name")} placeholder="Rohan Mehta / Mehta Traders" /></div>
          </div>
          <div className="field"><label className="label" htmlFor="qc-address">Address</label><input id="qc-address" className="input" value={customer.address} onChange={setCust("address")} /></div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="field"><label className="label" htmlFor="qc-email">Email</label><input id="qc-email" className="input" type="email" value={customer.email} onChange={setCust("email")} /></div>
            <div className="field"><label className="label" htmlFor="qc-gstin">GSTIN</label><input id="qc-gstin" className="input mono" value={customer.gstin} onChange={setCust("gstin")} maxLength={15} /></div>
          </div>
          <div className="field">
            <label className="label" htmlFor="qc-state">State</label>
            <select id="qc-state" className="select" value={customer.stateCode} onChange={(e) => setCustomer((c) => ({ ...c, stateCode: e.target.value, stateName: stateByCode(e.target.value)?.name ?? "" }))}>
              <option value="">Select state</option>
              {STATES.map((st) => <option key={st.code} value={st.code}>{st.name} ({st.code})</option>)}
            </select>
          </div>
        </section>

        <section className="card stack">
          <div className="field">
            <label className="label" htmlFor="q-subject">Subject <span className="muted">(optional)</span></label>
            <input id="q-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} placeholder="8 camera CCTV system for office" />
          </div>
          <div className="field">
            <label className="label" htmlFor="q-valid"><CalendarDays style={{ width: 14, verticalAlign: "-2px" }} /> Valid until</label>
            <input id="q-valid" type="date" className="input" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            <div className="row wrap" style={{ "--gap": "6px" } as React.CSSProperties}>
              {[7, 15, 30].map((n) => <button key={n} type="button" className="qchip" data-active={validUntil === plusDays(n)} onClick={() => setValidUntil(plusDays(n))}>{n} days</button>)}
            </div>
          </div>
          <div className="field">
            <span className="label">Quotation type</span>
            <div className="tabs" role="radiogroup">
              <button type="button" className="tab" role="radio" aria-checked={!gst} data-active={!gst} style={{ border: 0, cursor: "pointer" }} onClick={() => setQuoteType("PLAIN")}><ReceiptText style={{ width: 15 }} /> Without GST</button>
              <button type="button" className="tab" role="radio" aria-checked={gst} data-active={gst} style={{ border: 0, cursor: "pointer" }} onClick={() => setQuoteType("GST")}><FileText style={{ width: 15 }} /> GST</button>
            </div>
            <span className="hint">{gst ? "Shows your GSTIN, HSN codes and the GST breakdown." : "Prices only, GST included."}</span>
          </div>

          <dl className="totals">
            <dt>Items ({totals.items})</dt><dd>{formatINR(totals.gross)}</dd>
            {totals.discount > 0 && <><dt>Discount</dt><dd style={{ color: "var(--green)" }}>− {formatINR(totals.discount)}</dd></>}
            {gst && (
              <>
                <dt>Taxable value</dt><dd>{formatINR(totals.taxable)}</dd>
                {inter ? <><dt>IGST (incl.)</dt><dd>{formatINR(totals.tax)}</dd></> : <><dt>CGST (incl.)</dt><dd>{formatINR(Math.floor(totals.tax / 2))}</dd><dt>SGST (incl.)</dt><dd>{formatINR(totals.tax - Math.floor(totals.tax / 2))}</dd></>}
              </>
            )}
            {totals.roundOff !== 0 && <><dt>Round off</dt><dd>{totals.roundOff > 0 ? "+" : "−"} {formatINR(Math.abs(totals.roundOff))}</dd></>}
            <dt className="grand">Total</dt><dd className="grand">{formatINR(totals.grandTotal)}</dd>
          </dl>
          {totals.grandTotal > 0 && <span className="hint">{amountInWords(totals.grandTotal)}</span>}

          {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
          <div className="bill-buttons">
            <button type="button" className="btn btn-lg" disabled={busy} onClick={() => save(false)} title="Ctrl + S">{busy ? <span className="spinner" /> : <><Save /> Save</>}</button>
            <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => save(true)}>{busy ? <span className="spinner" /> : <><Eye /> Save & preview</>}</button>
          </div>
          <span className="hint" style={{ textAlign: "center" }}>{dirty ? "Unsaved changes · Ctrl + S to save" : editing ? "All changes saved" : "Preview to download or share the PDF"}</span>
        </section>
      </div>

      {picking && (
        <ProductPicker
          inBill={inQuote}
          ignoreStock
          actionLabel="Add to quotation"
          onClose={() => setPicking(false)}
          onAdd={(picks) => {
            setPicking(false);
            for (const { product, qty } of picks) addProduct(product, qty);
          }}
        />
      )}
    </div>
  );
}
