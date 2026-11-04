// Bill arithmetic. Pure functions with no database access, so the billing screen can preview
// totals live and the server can recompute them with the same rules when the bill is saved.
//
// Prices are GST-inclusive, as printed on the box (MRP). The tax is worked out backwards:
//   line total = unit price × qty − discount
//   taxable    = line total × 100 / (100 + GST rate)
//   GST        = line total − taxable        (shown on the invoice as CGST + SGST, half each)
import type { Paise } from "./money";

export type LineInput = { unitPrice: Paise; qty: number; discount: Paise; gstRate: number };
export type LineAmounts = { gross: Paise; discount: Paise; total: Paise; taxable: Paise; tax: Paise };
export type BillTotals = { gross: Paise; discount: Paise; taxable: Paise; tax: Paise; total: Paise; roundOff: Paise; grandTotal: Paise; items: number };

export function lineAmounts({ unitPrice, qty, discount, gstRate }: LineInput): LineAmounts {
  const gross = unitPrice * qty;
  const d = Math.min(Math.max(0, discount), gross);
  const total = gross - d;
  const taxable = Math.round((total * 100) / (100 + gstRate));
  return { gross, discount: d, total, taxable, tax: total - taxable };
}

/** Sums the lines and rounds the payable amount to the nearest rupee. */
export function billTotals(lines: LineInput[]): BillTotals {
  const t = { gross: 0, discount: 0, taxable: 0, tax: 0, total: 0, items: 0 };
  for (const l of lines) {
    const a = lineAmounts(l);
    t.gross += a.gross;
    t.discount += a.discount;
    t.taxable += a.taxable;
    t.tax += a.tax;
    t.total += a.total;
    t.items += l.qty;
  }
  const grandTotal = Math.round(t.total / 100) * 100;
  return { ...t, roundOff: grandTotal - t.total, grandTotal };
}

/** GST grouped by rate, for the tax summary on the invoice. */
export function taxByRate(lines: LineInput[]) {
  const map = new Map<number, { rate: number; taxable: Paise; tax: Paise }>();
  for (const l of lines) {
    const a = lineAmounts(l);
    const row = map.get(l.gstRate) ?? { rate: l.gstRate, taxable: 0, tax: 0 };
    row.taxable += a.taxable;
    row.tax += a.tax;
    map.set(l.gstRate, row);
  }
  return [...map.values()].sort((a, b) => a.rate - b.rate);
}
