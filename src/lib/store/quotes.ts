// Quotations: price offers to a customer. They don't touch stock. An accepted quotation can be
// turned into a bill on the billing screen, which links the two (quotation.sale).
import "server-only";
import { randomBytes } from "crypto";
import { isId, nextSequence } from "../db";
import { Product, Quotation, type IQuotation, type IQuoteItem, type QuoteStatus } from "./models";
import { billTotals, lineAmounts } from "./billing";
import { getBillSettings } from "./bill-settings";
import { isInterState, stateByCode, stateFromGstin } from "./bill-format";
import { quoteCode } from "./money";
import type { QuoteData } from "./schemas";
import { StoreError } from "./errors";

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function build(data: QuoteData) {
  const { seller } = await getBillSettings();
  const ids = [...new Set(data.items.map((i) => i.productId).filter(Boolean))];
  const products = ids.length ? await Product.find({ _id: { $in: ids } }).select("mrp").lean() : [];
  const mrp = new Map(products.map((p) => [String(p._id), p.mrp]));
  const items: IQuoteItem[] = data.items.map((i) => {
    const a = lineAmounts({ unitPrice: i.unitPrice, qty: i.qty, discount: i.discount, gstRate: i.gstRate });
    return {
      product: i.productId && mrp.has(i.productId) ? i.productId : undefined,
      name: i.name,
      description: i.description,
      hsn: i.hsn,
      unit: i.unit || "pcs",
      qty: i.qty,
      mrp: (i.productId && mrp.get(i.productId)) || 0,
      unitPrice: i.unitPrice,
      discount: a.discount,
      gstRate: i.gstRate,
      taxable: a.taxable,
      tax: a.tax,
      total: a.total,
    };
  });
  const t = billTotals(items);
  const st = stateFromGstin(data.customer.gstin);
  const code = data.customer.stateCode ? data.customer.stateCode.padStart(2, "0") : st?.code ?? "";
  const customerSnapshot = { ...data.customer, phone: data.customer.phone ?? "", stateCode: code, stateName: data.customer.stateName || stateByCode(code)?.name || "" };
  return {
    quoteType: data.quoteType,
    subject: data.subject,
    customer: data.customerId || undefined,
    customerSnapshot,
    interState: isInterState(seller.stateCode, code),
    items,
    gross: t.gross,
    discount: t.discount,
    taxable: t.taxable,
    tax: t.tax,
    roundOff: t.roundOff,
    grandTotal: t.grandTotal,
    validUntil: data.validUntil ? new Date(`${data.validUntil}T00:00:00`) : undefined,
    notes: data.notes,
    terms: data.terms,
  };
}

export async function createQuote(data: QuoteData, by: string) {
  const fields = await build(data);
  return Quotation.create({ ...fields, number: await nextSequence("quote"), shareToken: randomBytes(18).toString("base64url"), by });
}

export async function updateQuote(id: string, data: QuoteData) {
  if (!isId(id)) throw new StoreError("Quotation not found", 404);
  const q = await Quotation.findById(id).select("status").lean();
  if (!q) throw new StoreError("Quotation not found", 404);
  if (q.status === "CONVERTED") throw new StoreError("This quotation is already billed. Duplicate it to make changes.", 409);
  const fields = await build(data);
  await Quotation.updateOne({ _id: id }, fields.customer ? fields : { ...fields, $unset: { customer: 1 } });
}

export async function setQuoteStatus(id: string, status: QuoteStatus) {
  if (!isId(id)) throw new StoreError("Quotation not found", 404);
  const q = await Quotation.findById(id).select("status").lean();
  if (!q) throw new StoreError("Quotation not found", 404);
  if (q.status === "CONVERTED") throw new StoreError("This quotation is already billed", 409);
  if (status === "CONVERTED") throw new StoreError("A quotation becomes billed when you make the bill from it", 400);
  await Quotation.updateOne({ _id: id }, { status, ...(status === "SENT" && { sentAt: new Date() }) });
}

export async function duplicateQuote(id: string, by: string) {
  if (!isId(id)) throw new StoreError("Quotation not found", 404);
  const q = await Quotation.findById(id).lean();
  if (!q) throw new StoreError("Quotation not found", 404);
  const { _id, number: _n, shareToken: _t, status: _s, sale: _sale, sentAt: _sent, convertedAt: _c, createdAt: _ca, updatedAt: _ua, ...rest } = q as IQuotation & { _id: unknown };
  return Quotation.create({ ...rest, status: "DRAFT", number: await nextSequence("quote"), shareToken: randomBytes(18).toString("base64url"), by });
}

export async function deleteQuote(id: string) {
  if (!isId(id)) throw new StoreError("Quotation not found", 404);
  const q = await Quotation.findById(id).select("status").lean();
  if (!q) throw new StoreError("Quotation not found", 404);
  if (q.status === "CONVERTED") throw new StoreError("A billed quotation can't be deleted", 409);
  await Quotation.deleteOne({ _id: id });
}

/** Called by createSale when a bill is made from a quotation. */
export async function markQuoteConverted(id: string, saleId: string) {
  if (!isId(id)) return;
  await Quotation.updateOne({ _id: id, status: { $ne: "CONVERTED" } }, { status: "CONVERTED", sale: saleId, convertedAt: new Date() });
}

export async function listQuotes(opts: { q?: string; status?: QuoteStatus } = {}) {
  const q = opts.q?.trim() ?? "";
  const num = Number(q.replace(/^qt-?/i, ""));
  const rx = q ? new RegExp(escapeRx(q), "i") : null;
  return Quotation.find({
    ...(opts.status && { status: opts.status }),
    ...(rx && { $or: [{ "customerSnapshot.name": rx }, { "customerSnapshot.phone": rx }, { subject: rx }, { "items.name": rx }, ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : [])] }),
  })
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();
}

export async function quoteSummary() {
  return Quotation.aggregate<{ _id: QuoteStatus; count: number; value: number }>([{ $group: { _id: "$status", count: { $sum: 1 }, value: { $sum: "$grandTotal" } } }]);
}

export function quoteDTO(q: IQuotation & { _id: unknown }) {
  return {
    id: String(q._id),
    number: q.number,
    code: quoteCode(q.number),
    quoteType: q.quoteType,
    status: q.status,
    subject: q.subject ?? "",
    customerId: q.customer ? String(q.customer) : "",
    customer: {
      name: q.customerSnapshot?.name ?? "",
      phone: q.customerSnapshot?.phone ?? "",
      email: q.customerSnapshot?.email ?? "",
      address: q.customerSnapshot?.address ?? "",
      gstin: q.customerSnapshot?.gstin ?? "",
      stateName: q.customerSnapshot?.stateName ?? "",
      stateCode: q.customerSnapshot?.stateCode ?? "",
    },
    interState: !!q.interState,
    items: q.items.map((i) => ({
      productId: i.product ? String(i.product) : "",
      name: i.name,
      description: i.description ?? "",
      hsn: i.hsn ?? "",
      unit: i.unit ?? "pcs",
      qty: i.qty,
      mrp: i.mrp ?? 0,
      unitPrice: i.unitPrice,
      discount: i.discount ?? 0,
      gstRate: i.gstRate,
      taxable: i.taxable,
      tax: i.tax,
      total: i.total,
    })),
    gross: q.gross,
    discount: q.discount,
    taxable: q.taxable,
    tax: q.tax,
    roundOff: q.roundOff,
    grandTotal: q.grandTotal,
    validUntil: q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 10) : "",
    notes: q.notes ?? "",
    terms: q.terms ?? "",
    shareToken: q.shareToken,
    saleId: q.sale ? String(q.sale) : "",
    createdAt: new Date(q.createdAt).toISOString(),
    updatedAt: new Date(q.updatedAt).toISOString(),
  };
}
export type QuoteDTO = ReturnType<typeof quoteDTO>;
