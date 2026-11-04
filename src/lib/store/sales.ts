// Billing. createSale() is the one place a bill is made:
//   1. load the products and recompute every amount on the server (the browser's totals are only a preview)
//   2. take the stock, product by product, with a conditional update that fails if there isn't enough
//   3. save the customer and the bill, then write the stock ledger
// If any step fails, the stock already taken is put back. This keeps stock correct without
// MongoDB transactions, so a plain single-node MongoDB is enough.
import "server-only";
import { Types } from "mongoose";
import { isId, nextSequence } from "../db";
import { Product, Sale, StockMovement, type ISaleItem } from "./models";
import { billTotals, lineAmounts } from "./billing";
import { upsertCustomer } from "./customers";
import { getBillSettings } from "./bill-settings";
import { isInterState, stateByCode, stateFromGstin } from "./bill-format";
import type { SaleData } from "./schemas";
import { StoreError } from "./errors";

type Taken = { productId: string; qty: number; balanceAfter: number };

async function putBack(taken: Taken[]) {
  await Promise.all(taken.map((t) => Product.updateOne({ _id: t.productId }, { $inc: { stock: t.qty } })));
}

/** Fills a party's state from its GSTIN, or the name from the code, when one is missing. */
function withState<T extends { gstin?: string; stateName?: string; stateCode?: string }>(p: T): T {
  const fromGstin = stateFromGstin(p.gstin);
  const code = p.stateCode ? p.stateCode.padStart(2, "0") : fromGstin?.code ?? "";
  return { ...p, stateCode: code, stateName: p.stateName || stateByCode(code)?.name || "" };
}

export async function createSale(data: SaleData, soldBy: string) {
  const { seller } = await getBillSettings();
  if (data.billType === "GST" && !seller.gstin) throw new StoreError("Add your GSTIN in Bill settings before making a GST bill.");

  // Same product scanned twice at different prices stays as two lines; stock is checked per product.
  const ids = [...new Set(data.items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: ids } }).populate<{ category: { name: string } | null }>("category", "name").lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  for (const id of ids) {
    const p = byId.get(id);
    if (!p) throw new StoreError("A product in this bill no longer exists. Remove it and try again.");
    if (!p.active) throw new StoreError(`"${p.name}" has been removed from the catalog`);
  }

  const items: ISaleItem[] = data.items.map((i) => {
    const p = byId.get(i.productId)!;
    if (i.unitPrice > p.mrp) throw new StoreError(`Price of "${p.name}" can't be more than its MRP`);
    const a = lineAmounts({ unitPrice: i.unitPrice, qty: i.qty, discount: i.discount, gstRate: p.gstRate });
    return {
      product: p._id,
      name: p.name,
      barcode: p.barcode,
      sku: p.sku,
      category: p.category?.name ?? "",
      hsn: p.hsn,
      unit: p.unit,
      warrantyMonths: p.warrantyMonths,
      qty: i.qty,
      mrp: p.mrp,
      unitPrice: i.unitPrice,
      discount: a.discount,
      gstRate: p.gstRate,
      taxable: a.taxable,
      tax: a.tax,
      total: a.total,
    };
  });
  const totals = billTotals(items);

  const need = new Map<string, number>();
  for (const i of data.items) need.set(i.productId, (need.get(i.productId) ?? 0) + i.qty);

  const taken: Taken[] = [];
  for (const [productId, qty] of need) {
    const after = await Product.findOneAndUpdate({ _id: productId, stock: { $gte: qty } }, { $inc: { stock: -qty } }, { new: true }).select("stock").lean();
    if (!after) {
      await putBack(taken);
      const p = byId.get(productId)!;
      const now = (await Product.findById(productId).select("stock").lean())?.stock ?? 0;
      throw new StoreError(`Not enough stock for "${p.name}": ${now} left, bill needs ${qty}. Restock it under Products first.`, 409);
    }
    taken.push({ productId, qty, balanceAfter: after.stock });
  }

  try {
    const buyerInput = data.customer ? withState(data.customer) : null;
    const customer = buyerInput ? await upsertCustomer(buyerInput) : null;
    const buyer = customer
      ? withState({ name: customer.name, phone: customer.phone, email: customer.email, address: customer.address, gstin: customer.gstin, stateName: customer.stateName, stateCode: customer.stateCode })
      : { name: "Walk-in customer", phone: "", email: "", address: "", gstin: "", stateName: "", stateCode: "" };
    const consignee = data.consignee ? withState(data.consignee) : undefined;
    // Place of supply: where goods are delivered (consignee), else the buyer's state.
    const supplyState = consignee?.stateCode || buyer.stateCode;
    const details = Object.fromEntries(Object.entries(data.details).filter(([, v]) => v));
    const saleId = new Types.ObjectId();
    const sale = await Sale.create({
      _id: saleId,
      billType: data.billType,
      number: await nextSequence(data.billType === "GST" ? "invoice" : "bill"),
      customer: customer?._id,
      customerSnapshot: buyer,
      consignee,
      seller,
      details: Object.keys(details).length ? details : undefined,
      interState: data.billType === "GST" && isInterState(seller.stateCode, supplyState),
      items,
      gross: totals.gross,
      discount: totals.discount,
      taxable: totals.taxable,
      tax: totals.tax,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      paymentMode: data.paymentMode,
      notes: data.notes,
      soldBy,
    });
    await StockMovement.insertMany(taken.map((t) => ({ product: t.productId, change: -t.qty, balanceAfter: t.balanceAfter, reason: "SALE", sale: saleId, by: soldBy })));
    return sale;
  } catch (e) {
    await putBack(taken);
    throw e;
  }
}

/** Marks a bill cancelled and returns its items to stock. Safe to call twice. */
export async function cancelSale(id: string, by: string, reason: string) {
  if (!isId(id)) throw new StoreError("Bill not found", 404);
  const sale = await Sale.findOneAndUpdate({ _id: id, status: "PAID" }, { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: by, cancelReason: reason }, { new: true }).lean();
  if (!sale) {
    if (await Sale.exists({ _id: id })) throw new StoreError("This bill is already cancelled", 409);
    throw new StoreError("Bill not found", 404);
  }
  const back = new Map<string, number>();
  for (const i of sale.items) back.set(String(i.product), (back.get(String(i.product)) ?? 0) + i.qty);
  for (const [productId, qty] of back) {
    const p = await Product.findByIdAndUpdate(productId, { $inc: { stock: qty } }, { new: true }).select("stock").lean();
    if (p) await StockMovement.create({ product: productId, change: qty, balanceAfter: p.stock, reason: "SALE_CANCELLED", sale: sale._id, note: reason, by });
  }
  return sale;
}

/** Revenue for a period (cancelled bills excluded). */
export async function salesSummary(from: Date, to = new Date()) {
  const [row] = await Sale.aggregate<{ bills: number; revenue: number; tax: number; units: number }>([
    { $match: { status: "PAID", createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, bills: { $sum: 1 }, revenue: { $sum: "$grandTotal" }, tax: { $sum: "$tax" }, units: { $sum: { $sum: "$items.qty" } } } },
  ]);
  return row ?? { bills: 0, revenue: 0, tax: 0, units: 0 };
}
