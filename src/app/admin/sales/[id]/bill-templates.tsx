// Printable bills. GstInvoice follows the familiar Tally "Tax Invoice" layout; PlainBill is a
// simple bill with prices only. What each shows is chosen in Bill settings.
import { DETAIL_FIELDS, type BillDetails, type SectionKey } from "@/lib/store/bill-format";
import type { IParty, ISaleItem, ISeller } from "@/lib/store/models";
import { amountInWords, formatINR, invoiceCode } from "@/lib/store/money";

export type BillData = {
  number: number;
  billType: "PLAIN" | "GST";
  createdAt: Date;
  cancelled: boolean;
  seller: ISeller;
  buyer: Partial<IParty> & { name: string };
  consignee?: Partial<IParty> | null;
  details: BillDetails;
  interState: boolean;
  items: ISaleItem[];
  gross: number;
  discount: number;
  taxable: number;
  tax: number;
  roundOff: number;
  grandTotal: number;
  paymentLabel: string;
  notes: string;
  sections: SectionKey[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Tally-style date: 1-Oct-26 */
export const tallyDate = (d: Date | string) => {
  const x = typeof d === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d) : d;
  return Number.isNaN(x.getTime()) ? String(d) : `${x.getDate()}-${MONTHS[x.getMonth()]}-${String(x.getFullYear()).slice(2)}`;
};
const num = (paise: number) => (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const exclusive = (paise: number, rate: number) => Math.round((paise * 100) / (100 + rate));
const unitLabel = (u?: string) => {
  const v = u || "pcs";
  return v === "pcs" ? "Pcs" : v.charAt(0).toUpperCase() + v.slice(1);
};

/** A row under the items (tax, round off, spacer) that keeps every column's vertical line. */
function SummaryRow({ middle, label, amount }: { middle: number; label?: string; amount?: string }) {
  return (
    <tr className={label ? "ti-taxline" : "ti-spacer"}>
      <td />
      <td className="r">{label && <b><i>{label}</i></b>}</td>
      {Array.from({ length: middle }, (_, i) => <td key={i} />)}
      <td className="r">{amount && <b>{amount}</b>}</td>
    </tr>
  );
}

function Lines({ text }: { text?: string }) {
  if (!text) return null;
  return <>{text.split("\n").filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}</>;
}

function PartyBlock({ title, party, showContact, showTax }: { title?: string; party: Partial<IParty> & { name?: string }; showContact: boolean; showTax: boolean }) {
  return (
    <div className="ti-party">
      {title && <div className="ti-label">{title}</div>}
      <div className="ti-strong">{party.name}</div>
      <Lines text={party.address} />
      {showContact && party.phone && <div>Phone: {party.phone}</div>}
      {showContact && party.email && <div>E-Mail: {party.email}</div>}
      {showTax && party.gstin && <div>GSTIN/UIN&nbsp;&nbsp;: {party.gstin}</div>}
      {showTax && party.stateName && <div>State Name&nbsp;: {party.stateName}{party.stateCode && `, Code : ${party.stateCode}`}</div>}
    </div>
  );
}

function Seller({ s, on }: { s: ISeller; on: (k: SectionKey) => boolean }) {
  return (
    <div className="ti-party">
      <div className="ti-strong" style={{ fontSize: 15 }}>{s.companyName}</div>
      {on("companyContact") && (
        <>
          <Lines text={s.address} />
          {s.phone && <div>Phone: {s.phone}</div>}
        </>
      )}
      {on("companyTax") && (
        <>
          {s.gstin && <div>GSTIN/UIN: {s.gstin}</div>}
          {s.pan && <div>PAN: {s.pan}</div>}
          {s.stateName && <div>State Name : {s.stateName}{s.stateCode && `, Code : ${s.stateCode}`}</div>}
          <Lines text={s.licences} />
        </>
      )}
      {on("companyContact") && s.email && <div>E-Mail : {s.email}</div>}
    </div>
  );
}

function Footer({ d, on }: { d: BillData; on: (k: SectionKey) => boolean }) {
  const s = d.seller;
  const bank = on("bankDetails") && (s.bankName || s.bankAccount);
  return (
    <>
      <div className="ti-foot">
        <div className="ti-cell">
          {on("declaration") && s.declaration && (
            <>
              <div className="ti-label" style={{ textDecoration: "underline" }}>Declaration</div>
              <div>{s.declaration}</div>
            </>
          )}
          {on("terms") && s.terms && (
            <>
              <div className="ti-label" style={{ textDecoration: "underline", marginTop: on("declaration") && s.declaration ? 8 : 0 }}>Terms & Conditions</div>
              <div style={{ whiteSpace: "pre-line" }}>{s.terms}</div>
            </>
          )}
        </div>
        <div className="ti-cell">
          {bank && (
            <div className="ti-bank">
              <div className="ti-label">Company&apos;s Bank Details</div>
              {s.bankHolder && <div><span>A/c Holder&apos;s Name</span><span>:</span><b>{s.bankHolder}</b></div>}
              {s.bankName && <div><span>Bank Name</span><span>:</span><b>{s.bankName}</b></div>}
              {s.bankAccount && <div><span>A/c No.</span><span>:</span><b>{s.bankAccount}</b></div>}
              {s.bankBranchIfsc && <div><span>Branch &amp; IFS Code</span><span>:</span><b>{s.bankBranchIfsc}</b></div>}
            </div>
          )}
          {on("signature") && (
            <div className="ti-sign">
              <div className="ti-strong">for {s.companyName}</div>
              <div style={{ height: 46 }} />
              <div>Authorised Signatory</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function GstInvoice({ d }: { d: BillData }) {
  const on = (k: SectionKey) => d.sections.includes(k);
  const code = invoiceCode(d.number, d.billType);
  const anyDiscount = d.items.some((i) => i.discount > 0);
  const totalQty = d.items.reduce((a, i) => a + i.qty, 0);
  const units = [...new Set(d.items.map((i) => unitLabel(i.unit)))];

  // HSN summary: one row per HSN + rate. CGST is half the GST rounded down to the paisa, SGST the rest.
  const groups = new Map<string, { hsn: string; rate: number; taxable: number; tax: number }>();
  for (const i of d.items) {
    const key = `${i.hsn}|${i.gstRate}`;
    const g = groups.get(key) ?? { hsn: i.hsn || "—", rate: i.gstRate, taxable: 0, tax: 0 };
    g.taxable += i.taxable;
    g.tax += i.tax;
    groups.set(key, g);
  }
  const hsnRows = [...groups.values()].map((g) => ({ ...g, cgst: Math.floor(g.tax / 2), sgst: g.tax - Math.floor(g.tax / 2) }));
  const cgst = hsnRows.reduce((a, g) => a + g.cgst, 0);
  const sgst = hsnRows.reduce((a, g) => a + g.sgst, 0);
  const cols = 5 + (on("hsn") ? 1 : 0) + (anyDiscount ? 1 : 0);
  const detail = (k: (typeof DETAIL_FIELDS)[number]["key"]) => {
    const v = d.details[k];
    return v ? (/Date$/.test(k) ? tallyDate(v) : v) : "";
  };
  const box = (label: string, value: React.ReactNode) => (
    <div className="ti-box">
      <div className="ti-small">{label}</div>
      <div className="ti-strong">{value || " "}</div>
    </div>
  );

  return (
    <article className="tax-invoice" data-cancelled={d.cancelled}>
      <div className="ti-title">Tax Invoice</div>
      <div className="ti-frame">
        <div className="ti-head">
          <div className="ti-left">
            <div className="ti-cell"><Seller s={d.seller} on={on} /></div>
            {on("consignee") && (
              <div className="ti-cell">
                <PartyBlock title="Consignee (Ship to)" party={d.consignee?.name ? d.consignee : d.buyer} showContact={false} showTax={on("buyerTax")} />
              </div>
            )}
            <div className="ti-cell">
              <PartyBlock title="Buyer (Bill to)" party={d.buyer} showContact={on("buyerContact")} showTax={on("buyerTax")} />
            </div>
          </div>
          <div className="ti-right">
            {box("Invoice No.", code)}
            {box("Dated", tallyDate(d.createdAt))}
            {on("orderDetails") ? (
              <>
                {box("Delivery Note", detail("deliveryNote"))}
                {box("Mode/Terms of Payment", detail("paymentTerms") || d.paymentLabel)}
                {box("Reference No. & Date.", detail("referenceNo"))}
                {box("Other References", detail("otherReferences"))}
                {box("Buyer's Order No.", detail("buyerOrderNo"))}
                {box("Dated", detail("buyerOrderDate"))}
                {box("Dispatch Doc No.", detail("dispatchDocNo"))}
                {box("Delivery Note Date", detail("deliveryNoteDate"))}
                {box("Dispatched through", detail("dispatchedThrough"))}
                {box("Destination", detail("destination"))}
                <div className="ti-box ti-wide">
                  <div className="ti-small">Terms of Delivery</div>
                  <div className="ti-strong" style={{ whiteSpace: "pre-line" }}>{detail("termsOfDelivery") || " "}</div>
                </div>
              </>
            ) : (
              <>
                {box("Mode/Terms of Payment", d.paymentLabel)}
                {box("Place of Supply", d.consignee?.stateName || d.buyer.stateName || d.seller.stateName)}
              </>
            )}
          </div>
        </div>

        <table className="ti-items">
          <thead>
            <tr>
              <th style={{ width: 34 }}>Sl No.</th>
              <th>Description of Goods</th>
              {on("hsn") && <th style={{ width: 80 }}>HSN/SAC</th>}
              <th className="r" style={{ width: 80 }}>Quantity</th>
              <th className="r" style={{ width: 90 }}>Rate</th>
              <th style={{ width: 40 }}>per</th>
              {anyDiscount && <th className="r" style={{ width: 80 }}>Disc.</th>}
              <th className="r" style={{ width: 110 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((i, n) => (
              <tr key={n}>
                <td>{n + 1}</td>
                <td>
                  <div className="ti-strong">{i.name}</div>
                  {on("warranty") && i.warrantyMonths > 0 && <div className="ti-small"><i>Warranty: {i.warrantyMonths} months</i></div>}
                  {i.barcode && <div className="ti-small"><i>{i.barcode}</i></div>}
                </td>
                {on("hsn") && <td>{i.hsn}</td>}
                <td className="r"><b>{i.qty} {unitLabel(i.unit)}</b></td>
                <td className="r">{num(exclusive(i.unitPrice, i.gstRate))}</td>
                <td>{unitLabel(i.unit)}</td>
                {anyDiscount && <td className="r">{i.discount ? num(exclusive(i.discount, i.gstRate)) : ""}</td>}
                <td className="r"><b>{num(i.taxable)}</b></td>
              </tr>
            ))}
            <SummaryRow middle={cols - 2} />
            {d.interState ? (
              <SummaryRow middle={cols - 2} label="IGST" amount={num(d.tax)} />
            ) : (
              <>
                <SummaryRow middle={cols - 2} label="CGST" amount={num(cgst)} />
                <SummaryRow middle={cols - 2} label="SGST" amount={num(sgst)} />
              </>
            )}
            {d.roundOff !== 0 && <SummaryRow middle={cols - 2} label="Round Off" amount={`${d.roundOff < 0 ? "(-)" : ""}${num(Math.abs(d.roundOff))}`} />}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td className="r">Total</td>
              {on("hsn") && <td />}
              <td className="r"><b>{totalQty} {units.length === 1 ? units[0] : ""}</b></td>
              <td colSpan={anyDiscount ? 3 : 2} />
              <td className="r ti-grand">₹ {num(d.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        {on("amountInWords") && (
          <div className="ti-cell ti-words">
            <div className="row between"><span className="ti-small">Amount Chargeable (in words)</span><i className="ti-small">E. &amp; O.E</i></div>
            <div className="ti-strong">INR {amountInWords(d.grandTotal)}</div>
          </div>
        )}

        <table className="ti-hsn">
          <thead>
            <tr>
              <th rowSpan={2}>HSN/SAC</th>
              <th rowSpan={2} className="r">Taxable Value</th>
              {d.interState ? (
                <th colSpan={2} className="c">IGST</th>
              ) : (
                <>
                  <th colSpan={2} className="c">CGST</th>
                  <th colSpan={2} className="c">SGST/UTGST</th>
                </>
              )}
              <th rowSpan={2} className="r">Total Tax Amount</th>
            </tr>
            <tr>
              <th className="r">Rate</th><th className="r">Amount</th>
              {!d.interState && <><th className="r">Rate</th><th className="r">Amount</th></>}
            </tr>
          </thead>
          <tbody>
            {hsnRows.map((g) => (
              <tr key={`${g.hsn}-${g.rate}`}>
                <td>{g.hsn}</td>
                <td className="r">{num(g.taxable)}</td>
                {d.interState ? (
                  <><td className="r">{g.rate}%</td><td className="r">{num(g.tax)}</td></>
                ) : (
                  <>
                    <td className="r">{g.rate / 2}%</td><td className="r">{num(g.cgst)}</td>
                    <td className="r">{g.rate / 2}%</td><td className="r">{num(g.sgst)}</td>
                  </>
                )}
                <td className="r">{num(g.tax)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="r">Total</td>
              <td className="r">{num(d.taxable)}</td>
              {d.interState ? (
                <><td /><td className="r">{num(d.tax)}</td></>
              ) : (
                <><td /><td className="r">{num(cgst)}</td><td /><td className="r">{num(sgst)}</td></>
              )}
              <td className="r">{num(d.tax)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="ti-cell ti-words">
          {on("amountInWords") && <div>Tax Amount (in words)&nbsp;: <b>INR {amountInWords(d.tax)}</b></div>}
          {d.notes && <div style={{ marginTop: 4 }}>Remarks: {d.notes}</div>}
        </div>

        <Footer d={d} on={on} />
      </div>
      <div className="ti-computer">This is a Computer Generated Invoice</div>
    </article>
  );
}

export function PlainBill({ d }: { d: BillData }) {
  const on = (k: SectionKey) => d.sections.includes(k);
  const anyDiscount = d.items.some((i) => i.discount > 0);
  const totalQty = d.items.reduce((a, i) => a + i.qty, 0);
  const cols = 5 + (on("mrp") ? 1 : 0) + (on("hsn") ? 1 : 0) + (anyDiscount ? 1 : 0);

  return (
    <article className="tax-invoice" data-cancelled={d.cancelled}>
      <div className="ti-title">Bill</div>
      <div className="ti-frame">
        <div className="ti-head">
          <div className="ti-left">
            <div className="ti-cell"><Seller s={d.seller} on={on} /></div>
            <div className="ti-cell">
              <PartyBlock title="Bill to" party={d.buyer} showContact={on("buyerContact")} showTax={on("buyerTax")} />
            </div>
            {on("consignee") && d.consignee?.name && (
              <div className="ti-cell"><PartyBlock title="Ship to" party={d.consignee} showContact={false} showTax={on("buyerTax")} /></div>
            )}
          </div>
          <div className="ti-right">
            <div className="ti-box"><div className="ti-small">Bill No.</div><div className="ti-strong">{invoiceCode(d.number, d.billType)}</div></div>
            <div className="ti-box"><div className="ti-small">Dated</div><div className="ti-strong">{tallyDate(d.createdAt)}</div></div>
            <div className="ti-box ti-wide"><div className="ti-small">Payment</div><div className="ti-strong">{d.paymentLabel}</div></div>
            {on("orderDetails") &&
              DETAIL_FIELDS.filter((f) => d.details[f.key]).map((f) => (
                <div key={f.key} className="ti-box ti-wide"><div className="ti-small">{f.label}</div><div className="ti-strong">{/Date$/.test(f.key) ? tallyDate(d.details[f.key]!) : d.details[f.key]}</div></div>
              ))}
          </div>
        </div>

        <table className="ti-items">
          <thead>
            <tr>
              <th style={{ width: 34 }}>Sl No.</th>
              <th>Description of Goods</th>
              {on("hsn") && <th style={{ width: 80 }}>HSN/SAC</th>}
              {on("mrp") && <th className="r" style={{ width: 90 }}>MRP</th>}
              <th className="r" style={{ width: 80 }}>Quantity</th>
              <th className="r" style={{ width: 90 }}>Rate</th>
              <th style={{ width: 40 }}>per</th>
              {anyDiscount && <th className="r" style={{ width: 80 }}>Disc.</th>}
              <th className="r" style={{ width: 110 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((i, n) => (
              <tr key={n}>
                <td>{n + 1}</td>
                <td>
                  <div className="ti-strong">{i.name}</div>
                  {on("warranty") && i.warrantyMonths > 0 && <div className="ti-small"><i>Warranty: {i.warrantyMonths} months</i></div>}
                </td>
                {on("hsn") && <td>{i.hsn}</td>}
                {on("mrp") && <td className="r">{num(i.mrp)}</td>}
                <td className="r"><b>{i.qty} {unitLabel(i.unit)}</b></td>
                <td className="r">{num(i.unitPrice)}</td>
                <td>{unitLabel(i.unit)}</td>
                {anyDiscount && <td className="r">{i.discount ? num(i.discount) : ""}</td>}
                <td className="r"><b>{num(i.total)}</b></td>
              </tr>
            ))}
            <SummaryRow middle={cols - 2} />
            {d.roundOff !== 0 && <SummaryRow middle={cols - 2} label="Round Off" amount={`${d.roundOff < 0 ? "(-)" : ""}${num(Math.abs(d.roundOff))}`} />}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td className="r">Total</td>
              {on("hsn") && <td />}
              {on("mrp") && <td />}
              <td className="r"><b>{totalQty}</b></td>
              <td colSpan={anyDiscount ? 3 : 2} />
              <td className="r ti-grand">₹ {num(d.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        {on("amountInWords") && (
          <div className="ti-cell ti-words">
            <div className="row between"><span className="ti-small">Amount (in words)</span><i className="ti-small">E. &amp; O.E</i></div>
            <div className="ti-strong">INR {amountInWords(d.grandTotal)}</div>
          </div>
        )}
        {d.notes && <div className="ti-cell ti-words">Remarks: {d.notes}</div>}
        <Footer d={d} on={on} />
      </div>
      <div className="ti-computer">Thank you for your business · {formatINR(d.grandTotal)}</div>
    </article>
  );
}
