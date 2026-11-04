// Supplier bills for the stock we buy, normal (no GST) or GST, with photos/PDFs of the paper bill.
// Opening stock and restocks point to the bill they came in on (stock_movements.purchaseBill).
import "server-only";
import { isId } from "../db";
import { PurchaseBill, StockMovement, type IPurchaseBill } from "./models";
import { saveDocument } from "../storage";
import { StoreError } from "./errors";
import type { PurchaseBillData } from "./schemas";
import type { PurchaseType } from "./bill-format";

export const MAX_BILL_FILES = 10;

async function saveFiles(files: File[]) {
  try {
    return await Promise.all(files.map(saveDocument));
  } catch (e) {
    throw new StoreError(e instanceof Error ? e.message : "Upload failed");
  }
}

export async function createPurchaseBill(data: PurchaseBillData, files: File[], by: string) {
  if (!data.supplier && !data.billNo && files.length === 0) throw new StoreError("Enter the supplier or bill number, or attach the bill");
  if (files.length > MAX_BILL_FILES) throw new StoreError(`Up to ${MAX_BILL_FILES} files per bill`);
  return PurchaseBill.create({ ...data, files: await saveFiles(files), by });
}

export async function addBillFiles(id: string, files: File[]) {
  if (!isId(id)) throw new StoreError("Purchase bill not found", 404);
  const bill = await PurchaseBill.findById(id).select("files").lean();
  if (!bill) throw new StoreError("Purchase bill not found", 404);
  if (files.length === 0) throw new StoreError("Choose a photo or PDF of the bill");
  if (bill.files.length + files.length > MAX_BILL_FILES) throw new StoreError(`Up to ${MAX_BILL_FILES} files per bill`);
  const saved = await saveFiles(files);
  await PurchaseBill.updateOne({ _id: id }, { $push: { files: { $each: saved } } });
}

export async function listPurchaseBills(opts: { q?: string; type?: PurchaseType; limit?: number } = {}) {
  const q = opts.q?.trim();
  const rx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
  const bills = await PurchaseBill.find({ ...(opts.type && { billType: opts.type }), ...(rx && { $or: [{ supplier: rx }, { billNo: rx }, { notes: rx }] }) })
    .sort({ billDate: -1, createdAt: -1 })
    .limit(opts.limit ?? 200)
    .lean();
  const counts = await StockMovement.aggregate<{ _id: unknown; lines: number; units: number }>([
    { $match: { purchaseBill: { $in: bills.map((b) => b._id) } } },
    { $group: { _id: "$purchaseBill", lines: { $sum: 1 }, units: { $sum: "$change" } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c]));
  return bills.map((b) => ({ ...purchaseBillDTO(b), lines: byId.get(String(b._id))?.lines ?? 0, units: byId.get(String(b._id))?.units ?? 0 }));
}

export function purchaseBillDTO(b: Omit<IPurchaseBill, "by"> & { _id: unknown }) {
  return {
    id: String(b._id),
    billType: b.billType,
    supplier: b.supplier,
    billNo: b.billNo,
    billDate: b.billDate ? new Date(b.billDate).toISOString().slice(0, 10) : "",
    amount: b.amount,
    notes: b.notes,
    files: b.files.map((f) => ({ name: f.name, original: f.original, type: f.type, size: f.size })),
    createdAt: new Date(b.createdAt).toISOString(),
  };
}
export type PurchaseBillDTO = ReturnType<typeof purchaseBillDTO>;

/** Short label for pickers and stock history: "Sharma Traders · Bill 123 · 02 Nov 2026". */
export function billLabel(b: { supplier?: string; billNo?: string; billDate?: string | Date }) {
  const d = b.billDate ? new Date(b.billDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
  return [b.supplier, b.billNo && `Bill ${b.billNo}`, d].filter(Boolean).join(" · ") || "Purchase bill";
}
