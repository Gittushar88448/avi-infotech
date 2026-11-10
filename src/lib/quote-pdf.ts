// Builds the quotation as a real PDF file in the browser (jsPDF + autotable), so it can be
// downloaded, attached to WhatsApp / e-mail, or shared from a phone's share sheet.
// Loaded on demand (dynamic import) to keep the pages light.
import type { QuoteDTO } from "./store/quotes";
import type { ISeller } from "./store/models";
import { amountInWords } from "./store/money";
import { taxByRate } from "./store/billing";

type RGB = [number, number, number];
const ACCENT: RGB = [10, 108, 150];
const INK: RGB = [22, 32, 46];
const MUTED: RGB = [100, 112, 128];
const LINE: RGB = [214, 222, 232];
const SOFT: RGB = [237, 245, 250];

// Helvetica in PDFs has no ₹ glyph, so amounts are written "Rs. 1,23,456.00".
const num = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs = (paise: number) => `Rs. ${num.format(paise / 100)}`;
const plain = (paise: number) => num.format(paise / 100);
const day = (iso?: string) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

export async function buildQuotePdf(q: QuoteDTO, seller: ISeller) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const gst = q.quoteType === "GST";
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const text = (s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: RGB; align?: "left" | "right" | "center"; maxWidth?: number } = {}) => {
    doc.setFont("helvetica", o.bold ? "bold" : "normal");
    doc.setFontSize(o.size ?? 9.5);
    doc.setTextColor(...(o.color ?? INK));
    const lines = o.maxWidth ? doc.splitTextToSize(s, o.maxWidth) : s;
    doc.text(lines, x, y, { align: o.align ?? "left" });
    return Array.isArray(lines) ? lines.length : 1;
  };

  // ── Header ──────────────────────────────────────────
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, W, 4, "F");
  let y = 16;
  text(seller.companyName || "Quotation", M, y, { size: 17, bold: true });
  y += 6;
  const sellerLines = [
    seller.address,
    [seller.phone && `Phone: ${seller.phone}`, seller.email && `Email: ${seller.email}`].filter(Boolean).join("   "),
    gst && seller.gstin ? `GSTIN: ${seller.gstin}${seller.stateName ? `   State: ${seller.stateName}${seller.stateCode ? ` (${seller.stateCode})` : ""}` : ""}` : "",
  ].filter(Boolean) as string[];
  for (const l of sellerLines) y += text(l, M, y, { size: 9, color: MUTED, maxWidth: 110 }) * 4.2;

  text("QUOTATION", W - M, 17, { size: 20, bold: true, color: ACCENT, align: "right" });
  const meta: [string, string][] = [
    ["Quotation no.", q.code],
    ["Date", day(q.createdAt)],
    ...(q.validUntil ? [["Valid until", day(q.validUntil)] as [string, string]] : []),
  ];
  meta.forEach(([k, v], i) => {
    text(k, W - M - 34, 25 + i * 5, { size: 9, color: MUTED, align: "right" });
    text(v, W - M, 25 + i * 5, { size: 9, bold: true, align: "right" });
  });
  y = Math.max(y, 25 + meta.length * 5) + 3;
  doc.setDrawColor(...LINE);
  doc.line(M, y, W - M, y);
  y += 7;

  // ── Customer & subject ─────────────────────────────
  text("QUOTATION FOR", M, y, { size: 8, bold: true, color: MUTED });
  if (q.subject) text("SUBJECT", W / 2 + 4, y, { size: 8, bold: true, color: MUTED });
  y += 5;
  const startY = y;
  text(q.customer.name, M, y, { size: 11, bold: true });
  y += 5;
  const custLines = [
    q.customer.address,
    [q.customer.phone && `Phone: ${q.customer.phone}`, q.customer.email && `Email: ${q.customer.email}`].filter(Boolean).join("   "),
    gst && q.customer.gstin ? `GSTIN: ${q.customer.gstin}` : "",
    gst && q.customer.stateName ? `State: ${q.customer.stateName}${q.customer.stateCode ? ` (${q.customer.stateCode})` : ""}` : "",
  ].filter(Boolean) as string[];
  for (const l of custLines) y += text(l, M, y, { size: 9, color: MUTED, maxWidth: W / 2 - M - 4 }) * 4.2;
  if (q.subject) {
    const n = text(q.subject, W / 2 + 4, startY, { size: 10, bold: true, maxWidth: W / 2 - M - 4 });
    y = Math.max(y, startY + n * 4.6);
  }
  y += 3;

  // ── Items ───────────────────────────────────────────
  const head = gst
    ? [["#", "Description", "HSN/SAC", "Qty", "Rate", "Disc.", "GST", "Amount"]]
    : [["#", "Description", "Qty", "Rate", "Disc.", "Amount"]];
  const body = q.items.map((it, i) => {
    const desc = it.description ? `${it.name}\n${it.description}` : it.name;
    const qty = `${it.qty} ${it.unit}`;
    return gst
      ? [String(i + 1), desc, it.hsn || "-", qty, plain(it.unitPrice), it.discount ? plain(it.discount) : "-", `${it.gstRate}%`, plain(it.total)]
      : [String(i + 1), desc, qty, plain(it.unitPrice), it.discount ? plain(it.discount) : "-", plain(it.total)];
  });
  const right = { halign: "right" as const };
  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: M, right: M, bottom: 20 },
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 2.6, bottom: 2.6, left: 2, right: 2 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: "bold", lineWidth: 0 },
    alternateRowStyles: { fillColor: [250, 252, 254] },
    columnStyles: gst
      ? { 0: { cellWidth: 8 }, 1: { cellWidth: "auto" }, 2: { cellWidth: 18 }, 3: { cellWidth: 16, ...right }, 4: { cellWidth: 22, ...right }, 5: { cellWidth: 17, ...right }, 6: { cellWidth: 12, ...right }, 7: { cellWidth: 25, ...right } }
      : { 0: { cellWidth: 8 }, 1: { cellWidth: "auto" }, 2: { cellWidth: 18, ...right }, 3: { cellWidth: 26, ...right }, 4: { cellWidth: 20, ...right }, 5: { cellWidth: 28, ...right } },
    didParseCell: (d) => {
      if (d.section === "head" && d.column.index >= (gst ? 3 : 2)) d.cell.styles.halign = "right";
    },
  });
  y = lastY() + 6;

  // ── Totals ──────────────────────────────────────────
  const rows: [string, string, boolean?][] = [["Sub total", rs(q.gross)]];
  if (q.discount) rows.push(["Discount", `- ${rs(q.discount)}`]);
  if (gst) {
    rows.push(["Taxable value", rs(q.taxable)]);
    if (q.interState) rows.push(["IGST (included)", rs(q.tax)]);
    else {
      rows.push(["CGST (included)", rs(Math.floor(q.tax / 2))]);
      rows.push(["SGST (included)", rs(q.tax - Math.floor(q.tax / 2))]);
    }
  }
  if (q.roundOff) rows.push(["Round off", `${q.roundOff > 0 ? "+" : "-"} ${rs(Math.abs(q.roundOff))}`]);
  const boxW = 80;
  const needed = rows.length * 5.5 + 16;
  if (y + needed > H - 24) {
    doc.addPage();
    y = 20;
  }
  const bx = W - M - boxW;
  rows.forEach(([k, v], i) => {
    text(k, bx, y + i * 5.5, { size: 9.5, color: MUTED });
    text(v, W - M, y + i * 5.5, { size: 9.5, align: "right" });
  });
  y += rows.length * 5.5;
  doc.setFillColor(...SOFT);
  doc.roundedRect(bx - 3, y - 3, boxW + 3, 11, 1.5, 1.5, "F");
  text("Grand total", bx, y + 4, { size: 11, bold: true });
  text(rs(q.grandTotal), W - M - 1, y + 4, { size: 12, bold: true, color: ACCENT, align: "right" });
  const totalsBottom = y + 10;

  // Amount in words, beside the totals.
  let ly = lastY() + 6;
  text("Amount in words", M, ly, { size: 8, bold: true, color: MUTED });
  ly += 4.5;
  ly += text(`Indian ${amountInWords(q.grandTotal)}`, M, ly, { size: 9.5, bold: true, maxWidth: W - M * 2 - boxW - 10 }) * 4.4;
  if (gst) {
    const rates = taxByRate(q.items);
    ly += 3;
    autoTable(doc, {
      startY: ly,
      margin: { left: M, right: M + boxW + 10 },
      head: [["GST rate", "Taxable", q.interState ? "IGST" : "CGST + SGST"]],
      body: rates.map((r) => [`${r.rate}%`, plain(r.taxable), plain(r.tax)]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.6, textColor: INK, lineColor: LINE, lineWidth: 0.2 },
      headStyles: { fillColor: SOFT, textColor: INK, fontStyle: "bold" },
      columnStyles: { 1: right, 2: right },
    });
    ly = lastY() + 2;
  }
  y = Math.max(totalsBottom, ly) + 8;

  // ── Notes, terms, bank, signature ──────────────────
  const block = (title: string, body: string) => {
    if (!body.trim()) return;
    const lines = doc.splitTextToSize(body.trim(), W - M * 2);
    if (y + 6 + lines.length * 4.2 > H - 22) {
      doc.addPage();
      y = 20;
    }
    text(title, M, y, { size: 8, bold: true, color: MUTED });
    y += 4.5;
    text(body.trim(), M, y, { size: 9, maxWidth: W - M * 2 });
    y += lines.length * 4.2 + 4;
  };
  block("Notes", q.notes);
  block("Terms & conditions", q.terms);
  const bank = [
    seller.bankHolder && `A/c holder: ${seller.bankHolder}`,
    seller.bankName && `Bank: ${seller.bankName}`,
    seller.bankAccount && `A/c no.: ${seller.bankAccount}`,
    seller.bankBranchIfsc && `Branch & IFSC: ${seller.bankBranchIfsc}`,
  ].filter(Boolean).join("\n");
  block("Bank details", bank);

  if (y + 24 > H - 20) {
    doc.addPage();
    y = 20;
  }
  y += 4;
  text(`for ${seller.companyName || ""}`, W - M, y, { size: 9.5, bold: true, align: "right" });
  doc.setDrawColor(...LINE);
  doc.line(W - M - 55, y + 14, W - M, y + 14);
  text("Authorised Signatory", W - M, y + 18.5, { size: 8.5, color: MUTED, align: "right" });

  // ── Footer on every page ───────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.line(M, H - 12, W - M, H - 12);
    text("This is a quotation, not a tax invoice. Prices include GST unless stated.", M, H - 7.5, { size: 7.5, color: MUTED });
    text(`${q.code}  ·  Page ${i} of ${pages}`, W - M, H - 7.5, { size: 7.5, color: MUTED, align: "right" });
  }

  const filename = `Quotation-${q.code}${q.customer.name ? `-${q.customer.name.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}` : ""}.pdf`;
  return { doc, filename, blob: doc.output("blob") as Blob };
}
