// The quotation as a page (preview in the admin and the customer's link). The PDF is drawn
// separately by lib/quote-pdf.ts with the same content and layout.
import { amountInWords, formatINR } from "@/lib/store/money";
import { taxByRate } from "@/lib/store/billing";
import type { QuoteDTO } from "@/lib/store/quotes";
import type { ISeller } from "@/lib/store/models";

const day = (iso?: string) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

export function QuoteDocument({ q, seller }: { q: QuoteDTO; seller: ISeller }) {
  const gst = q.quoteType === "GST";
  const half = Math.floor(q.tax / 2);
  const bank = [seller.bankHolder && `A/c holder: ${seller.bankHolder}`, seller.bankName && `Bank: ${seller.bankName}`, seller.bankAccount && `A/c no.: ${seller.bankAccount}`, seller.bankBranchIfsc && `Branch & IFSC: ${seller.bankBranchIfsc}`].filter(Boolean);
  return (
    <article className="quote-paper stack" style={{ "--gap": "22px" } as React.CSSProperties}>
      <header className="row between wrap" style={{ alignItems: "flex-start", borderTop: "4px solid #0a6c96", paddingTop: 18 }}>
        <div className="stack" style={{ "--gap": "3px", maxWidth: 440 } as React.CSSProperties}>
          <strong style={{ fontSize: 22 }}>{seller.companyName}</strong>
          {seller.address && <span className="q-muted" style={{ whiteSpace: "pre-line" }}>{seller.address}</span>}
          <span className="q-muted">{[seller.phone && `Phone: ${seller.phone}`, seller.email && `Email: ${seller.email}`].filter(Boolean).join("   ")}</span>
          {gst && seller.gstin && <span className="q-muted">GSTIN: {seller.gstin}{seller.stateName && ` · ${seller.stateName}${seller.stateCode ? ` (${seller.stateCode})` : ""}`}</span>}
        </div>
        <div className="stack" style={{ "--gap": "4px", textAlign: "right" } as React.CSSProperties}>
          <h2 style={{ margin: 0, fontSize: 26 }}>QUOTATION</h2>
          <span><span className="q-muted">No.</span> <b className="mono">{q.code}</b></span>
          <span><span className="q-muted">Date</span> <b>{day(q.createdAt)}</b></span>
          {q.validUntil && <span><span className="q-muted">Valid until</span> <b>{day(q.validUntil)}</b></span>}
        </div>
      </header>

      <div className="row between wrap" style={{ alignItems: "flex-start", gap: 18 }}>
        <div className="stack" style={{ "--gap": "3px" } as React.CSSProperties}>
          <span className="q-muted" style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em" }}>QUOTATION FOR</span>
          <strong style={{ fontSize: 16 }}>{q.customer.name}</strong>
          {q.customer.address && <span className="q-muted">{q.customer.address}</span>}
          {(q.customer.phone || q.customer.email) && <span className="q-muted">{[q.customer.phone, q.customer.email].filter(Boolean).join(" · ")}</span>}
          {gst && q.customer.gstin && <span className="q-muted">GSTIN: {q.customer.gstin}</span>}
          {gst && q.customer.stateName && <span className="q-muted">State: {q.customer.stateName}{q.customer.stateCode && ` (${q.customer.stateCode})`}</span>}
        </div>
        {q.subject && (
          <div className="stack" style={{ "--gap": "3px", maxWidth: 360 } as React.CSSProperties}>
            <span className="q-muted" style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em" }}>SUBJECT</span>
            <strong>{q.subject}</strong>
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Description</th>{gst && <th>HSN/SAC</th>}<th className="num">Qty</th><th className="num">Rate</th><th className="num">Disc.</th>{gst && <th className="num">GST</th>}<th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><b>{it.name}</b>{it.description && <div className="q-muted" style={{ fontSize: 12.5, whiteSpace: "pre-line" }}>{it.description}</div>}</td>
                {gst && <td className="mono">{it.hsn || "—"}</td>}
                <td className="num">{it.qty} {it.unit}</td>
                <td className="num">{formatINR(it.unitPrice)}</td>
                <td className="num">{it.discount ? formatINR(it.discount) : "—"}</td>
                {gst && <td className="num">{it.gstRate}%</td>}
                <td className="num"><b>{formatINR(it.total)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row between wrap" style={{ alignItems: "flex-start", gap: 24 }}>
        <div className="stack" style={{ "--gap": "8px", flex: "1 1 280px" } as React.CSSProperties}>
          <span className="q-muted" style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em" }}>AMOUNT IN WORDS</span>
          <b>Indian {amountInWords(q.grandTotal)}</b>
          {gst && (
            <table style={{ maxWidth: 360, fontSize: 12.5 }}>
              <thead><tr><th>GST rate</th><th className="num">Taxable</th><th className="num">{q.interState ? "IGST" : "CGST + SGST"}</th></tr></thead>
              <tbody>{taxByRate(q.items).map((r) => <tr key={r.rate}><td>{r.rate}%</td><td className="num">{formatINR(r.taxable)}</td><td className="num">{formatINR(r.tax)}</td></tr>)}</tbody>
            </table>
          )}
        </div>
        <dl className="stack" style={{ "--gap": "6px", margin: 0, flex: "0 1 300px" } as React.CSSProperties}>
          {([
            ["Sub total", formatINR(q.gross)],
            ...(q.discount ? [["Discount", `− ${formatINR(q.discount)}`]] : []),
            ...(gst ? [["Taxable value", formatINR(q.taxable)], ...(q.interState ? [["IGST (included)", formatINR(q.tax)]] : [["CGST (included)", formatINR(half)], ["SGST (included)", formatINR(q.tax - half)]])] : []),
            ...(q.roundOff ? [["Round off", `${q.roundOff > 0 ? "+" : "−"} ${formatINR(Math.abs(q.roundOff))}`]] : []),
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="row between"><dt className="q-muted">{k}</dt><dd style={{ margin: 0 }} className="num">{v}</dd></div>
          ))}
          <div className="row between q-total"><dt>Grand total</dt><dd style={{ margin: 0, color: "#0a6c96" }}>{formatINR(q.grandTotal)}</dd></div>
        </dl>
      </div>

      {q.notes && <section><div className="q-muted" style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em" }}>NOTES</div><p style={{ whiteSpace: "pre-line", margin: "4px 0 0" }}>{q.notes}</p></section>}
      {q.terms && <section><div className="q-muted" style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em" }}>TERMS & CONDITIONS</div><p style={{ whiteSpace: "pre-line", margin: "4px 0 0" }}>{q.terms}</p></section>}
      <div className="row between wrap" style={{ alignItems: "flex-end", gap: 18 }}>
        {bank.length > 0 ? <section><div className="q-muted" style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em" }}>BANK DETAILS</div>{bank.map((b) => <div key={b as string}>{b}</div>)}</section> : <span />}
        <div style={{ textAlign: "right" }}><b>for {seller.companyName}</b><div style={{ height: 44 }} /><span className="q-muted" style={{ borderTop: "1px solid #d6dee8", paddingTop: 4 }}>Authorised Signatory</span></div>
      </div>
      <footer className="q-muted" style={{ fontSize: 11.5, borderTop: "1px solid #d6dee8", paddingTop: 8 }}>This is a quotation, not a tax invoice. Prices include GST unless stated.</footer>
    </article>
  );
}
