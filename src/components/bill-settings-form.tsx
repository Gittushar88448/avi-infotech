"use client";

import { useState } from "react";
import { AlertCircle, Save } from "lucide-react";
import { SECTIONS, STATES, stateByCode, stateFromGstin, type SectionKey } from "@/lib/store/bill-format";
import type { BillSettingsDTO } from "@/lib/store/bill-settings";

type Seller = BillSettingsDTO["seller"];

/**
 * Edits the shop's details printed on bills and which sections each kind of bill shows.
 * Used on the Bill settings page and in a dialog on the billing screen.
 */
export function BillSettingsForm({ initial, onSaved, onCancel }: { initial: BillSettingsDTO; onSaved: (s: BillSettingsDTO) => void; onCancel?: () => void }) {
  const [seller, setSeller] = useState<Seller>(initial.seller);
  const [plain, setPlain] = useState<SectionKey[]>(initial.sections.PLAIN);
  const [gst, setGst] = useState<SectionKey[]>(initial.sections.GST);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Seller) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setSeller((s) => ({ ...s, [k]: e.target.value }));
  const toggle = (list: SectionKey[], setList: (l: SectionKey[]) => void, key: SectionKey) => setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/bill-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...seller, plainSections: plain, gstSections: gst }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't save");
    onSaved(data);
  }

  const text = (k: keyof Seller, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label className="label" htmlFor={`bs-${k}`}>{label}</label>
      <input id={`bs-${k}`} className="input" value={seller[k]} onChange={set(k)} {...props} />
    </div>
  );

  return (
    <form onSubmit={save} className="stack" style={{ "--gap": "18px" } as React.CSSProperties}>
      <section className="stack">
        <span className="card-title">Company</span>
        {text("companyName", "Company name", { required: true, placeholder: "AVI INFOTECH" })}
        <div className="field">
          <label className="label" htmlFor="bs-address">Address</label>
          <textarea id="bs-address" className="textarea" style={{ minHeight: 70 }} value={seller.address} onChange={set("address")} placeholder={"Shop 12, Main Market\nSector 18, Noida"} />
        </div>
        <div className="grid-2">
          {text("phone", "Phone")}
          {text("email", "E-Mail", { type: "email" })}
        </div>
      </section>

      <section className="stack">
        <span className="card-title">GST and licences <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>(printed on GST bills)</span></span>
        <div className="grid-2">
          <div className="field">
            <label className="label" htmlFor="bs-gstin">GSTIN/UIN</label>
            <input
              id="bs-gstin"
              className="input mono"
              maxLength={15}
              value={seller.gstin}
              onChange={(e) => {
                const gstin = e.target.value.toUpperCase();
                const st = stateFromGstin(gstin);
                setSeller((s) => ({ ...s, gstin, ...(st && !s.stateCode ? { stateCode: st.code, stateName: st.name } : {}) }));
              }}
              placeholder="09ABCDE1234F1Z5"
            />
          </div>
          {text("pan", "PAN", { className: "input mono", maxLength: 10 })}
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="label" htmlFor="bs-state">State Name, Code</label>
            <select
              id="bs-state"
              className="select"
              value={seller.stateCode}
              onChange={(e) => setSeller((s) => ({ ...s, stateCode: e.target.value, stateName: stateByCode(e.target.value)?.name ?? "" }))}
            >
              <option value="">Select state</option>
              {STATES.map((st) => <option key={st.code} value={st.code}>{st.name} ({st.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="bs-licences">Other licence numbers <span className="muted">(one per line)</span></label>
            <textarea id="bs-licences" className="textarea" style={{ minHeight: 42 }} value={seller.licences} onChange={set("licences")} placeholder="Udyam: UDYAM-UP-00-0000000" />
          </div>
        </div>
      </section>

      <section className="stack">
        <span className="card-title">Company's bank details</span>
        <div className="grid-2">
          {text("bankHolder", "A/c Holder's Name", { placeholder: "AVI INFOTECH" })}
          {text("bankName", "Bank Name")}
          {text("bankAccount", "A/c No.", { className: "input mono" })}
          {text("bankBranchIfsc", "Branch & IFS Code")}
        </div>
      </section>

      <section className="stack">
        <div className="field">
          <label className="label" htmlFor="bs-decl">Declaration</label>
          <textarea id="bs-decl" className="textarea" style={{ minHeight: 70 }} value={seller.declaration} onChange={set("declaration")} />
        </div>
        <div className="field">
          <label className="label" htmlFor="bs-terms">Terms & conditions</label>
          <textarea id="bs-terms" className="textarea" style={{ minHeight: 70 }} value={seller.terms} onChange={set("terms")} />
        </div>
      </section>

      <section className="stack">
        <span className="card-title">What to print on each bill</span>
        <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 14 }}>
          <table className="table">
            <thead><tr><th>Section</th><th style={{ textAlign: "center", width: 90 }}>Bill</th><th style={{ textAlign: "center", width: 90 }}>GST Bill</th></tr></thead>
            <tbody>
              {SECTIONS.map((s) => (
                <tr key={s.key}>
                  <td>{s.label}</td>
                  <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={`${s.label} on Bill`} checked={plain.includes(s.key)} onChange={() => toggle(plain, setPlain, s.key)} /></td>
                  <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={`${s.label} on GST Bill`} checked={gst.includes(s.key)} onChange={() => toggle(gst, setGst, s.key)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span className="hint">A GST Bill always shows the tax breakdown. A plain Bill never shows tax. Changes apply to new bills; bills already made keep the details they were printed with.</span>
      </section>

      {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
        <button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : <><Save /> Save bill settings</>}</button>
      </div>
    </form>
  );
}
