// Catalog and stock. All stock changes go through changeStock(), which updates the product
// atomically and writes a ledger row, so the stock figure can always be explained.
import "server-only";
import { isId, nextSequence } from "../db";
import { Category, Product, Quotation, Sale, StockMovement, type IProduct, type MovementReason } from "./models";
import { skuCode } from "./money";
import { ImportRow, type ProductData } from "./schemas";
import { StoreError } from "./errors";
import { purchaseTypeOf, type PurchaseType } from "./bill-format";

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds a category by name (case-insensitive) or creates it. */
export async function ensureCategory(name: string) {
  const existing = await Category.findOne({ name: new RegExp(`^${escapeRx(name.trim())}$`, "i") });
  if (existing) return existing;
  try {
    return await Category.create({ name: name.trim() });
  } catch {
    // Created by a parallel request a moment ago.
    return (await Category.findOne({ name: new RegExp(`^${escapeRx(name.trim())}$`, "i") }))!;
  }
}

export async function listCategories() {
  return Category.find().sort({ name: 1 }).lean();
}

/** Exact match on barcode or SKU. This is what a scan calls. */
export async function findByCode(code: string) {
  const c = code.trim();
  if (!c) return null;
  return Product.findOne({ active: true, $or: [{ barcode: c }, { sku: c.toUpperCase() }] }).populate<{ category: { name: string } }>("category", "name").lean();
}

/** Free-text search across name, brand, model, SKU and barcode. */
export async function searchProducts(q: string, opts: { categoryId?: string; stock?: "low" | "out"; purchaseType?: PurchaseType; limit?: number; includeInactive?: boolean } = {}) {
  const rx = q.trim() ? new RegExp(escapeRx(q.trim()), "i") : null;
  const filter: Record<string, unknown> = {
    ...(!opts.includeInactive ? { active: true } : { deletedAt: { $exists: false } }),
    ...(rx && { $or: [{ name: rx }, { brand: rx }, { model: rx }, { sku: rx }, { barcode: rx }] }),
    ...(opts.categoryId && isId(opts.categoryId) && { category: opts.categoryId }),
    ...(opts.purchaseType === "LOCAL" && { purchaseType: "LOCAL" }),
    ...(opts.purchaseType === "GST" && { purchaseType: { $ne: "LOCAL" } }),
    ...(opts.stock === "out" && { stock: { $lte: 0 } }),
    ...(opts.stock === "low" && { $expr: { $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", "$lowStockAt"] }] } }),
  };
  return Product.find(filter)
    .sort({ name: 1 })
    .limit(opts.limit ?? 500)
    .populate<{ category: { _id: unknown; name: string } }>("category", "name")
    .lean();
}

/** Shapes a product for the browser (ids as strings, category name flattened). */
export function productDTO(p: Omit<IProduct, "category"> & { _id: unknown; category: { name: string } | unknown }) {
  const cat = p.category as { name?: string } | null;
  return {
    id: String(p._id),
    name: p.name,
    barcode: p.barcode ?? "",
    sku: p.sku,
    category: cat?.name ?? "",
    brand: p.brand,
    model: p.model,
    description: p.description,
    unit: p.unit,
    hsn: p.hsn,
    mrp: p.mrp,
    price: p.price,
    costPrice: p.costPrice,
    gstRate: p.gstRate,
    purchaseType: purchaseTypeOf(p.purchaseType),
    stock: p.stock,
    lowStockAt: p.lowStockAt,
    warrantyMonths: p.warrantyMonths,
    active: p.active,
    deleted: !!p.deletedAt,
  };
}
export type ProductDTO = ReturnType<typeof productDTO>;

function fields(data: ProductData, categoryId: unknown) {
  const { categoryName: _c, barcode, ...rest } = data;
  return { ...rest, category: categoryId, barcode: barcode || undefined };
}

export async function createProduct(data: ProductData & { openingStock: number; purchaseBillId?: string }, by: string) {
  const { openingStock, purchaseBillId, ...input } = data;
  if (input.barcode && (await Product.exists({ barcode: input.barcode }))) throw new StoreError("Another product already has this barcode", 409);
  const category = await ensureCategory(input.categoryName);
  const product = await Product.create({ ...fields(input, category._id), sku: skuCode(await nextSequence("sku")), stock: 0 });
  if (openingStock > 0) await changeStock(String(product._id), openingStock, "OPENING", { by, note: "Opening stock", purchaseBillId: purchaseBillId || undefined });
  return product;
}

export async function updateProduct(id: string, data: ProductData) {
  if (!isId(id)) throw new StoreError("Product not found", 404);
  if (data.barcode && (await Product.exists({ barcode: data.barcode, _id: { $ne: id } }))) throw new StoreError("Another product already has this barcode", 409);
  const category = await ensureCategory(data.categoryName);
  const { barcode, ...set } = fields(data, category._id);
  const updated = await Product.findByIdAndUpdate(id, barcode ? { ...set, barcode } : { ...set, $unset: { barcode: 1 } }, { new: true });
  if (!updated) throw new StoreError("Product not found", 404);
  return updated;
}

/** Hides a product from billing and the catalog. Sales history keeps referring to it. */
/**
 * Deletes a product. A product that was never billed or quoted is removed completely, with its
 * stock history. One that old bills or quotations still point to is taken out of the catalog,
 * billing, search and lists for good, and its barcode and SKU are freed for a new product;
 * the old bills keep their own copy of the name, price and barcode.
 */
export async function deleteProduct(id: string): Promise<"removed" | "archived"> {
  if (!isId(id)) throw new StoreError("Product not found", 404);
  const p = await Product.findById(id).select("sku deletedAt").lean();
  if (!p || p.deletedAt) throw new StoreError("Product not found", 404);
  const used = (await Sale.exists({ "items.product": id })) || (await Quotation.exists({ "items.product": id }));
  if (!used) {
    await Product.deleteOne({ _id: id });
    await StockMovement.deleteMany({ product: id });
    return "removed";
  }
  await Product.updateOne(
    { _id: id },
    { active: false, deletedAt: new Date(), sku: `${p.sku}~DEL-${Date.now().toString(36).toUpperCase()}`, $unset: { barcode: 1 } },
  );
  return "archived";
}

export async function setProductActive(id: string, active: boolean) {
  if (!isId(id)) throw new StoreError("Product not found", 404);
  const res = await Product.updateOne({ _id: id, deletedAt: { $exists: false } }, { active });
  if (!res.matchedCount) throw new StoreError("Product not found", 404);
}

/**
 * Adds (change > 0) or removes (change < 0) stock and records why. Removing more than is in
 * stock fails unless allowNegative is set, so two tills can never sell the last unit twice.
 * Returns the stock left.
 */
export async function changeStock(
  productId: string,
  change: number,
  reason: MovementReason,
  opts: { by?: string; note?: string; saleId?: string; purchaseBillId?: string; allowNegative?: boolean } = {},
) {
  const guard = change < 0 && !opts.allowNegative ? { stock: { $gte: -change } } : {};
  const p = await Product.findOneAndUpdate({ _id: productId, ...guard }, { $inc: { stock: change } }, { new: true }).select("stock name").lean();
  if (!p) {
    const exists = await Product.findById(productId).select("name stock").lean();
    if (!exists) throw new StoreError("Product not found", 404);
    throw new StoreError(`Only ${exists.stock} of "${exists.name}" in stock`, 409);
  }
  await StockMovement.create({ product: productId, change, balanceAfter: p.stock, reason, sale: opts.saleId, purchaseBill: opts.purchaseBillId, note: opts.note ?? "", by: opts.by });
  return p.stock;
}

export type ImportResult = { line: number; status: "created" | "updated" | "error"; name: string; message?: string };

/**
 * Creates or updates products from CSV rows. A row matches an existing product by barcode, then
 * by SKU; anything else is a new product. Stock changes go through the ledger like any other.
 * Rows are independent: one bad row doesn't stop the rest.
 */
export async function importProducts(rows: { line: number; data: Record<string, string> }[], stockMode: "set" | "add", by: string) {
  const results: ImportResult[] = [];
  for (const { line, data } of rows) {
    const name = data.name ?? "";
    const parsed = ImportRow.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      results.push({ line, status: "error", name, message: `${issue.path.join(".") || "Row"}: ${issue.message}` });
      continue;
    }
    const { sku, stock, ...product } = parsed.data;
    try {
      const existing = await Product.findOne(product.barcode ? { barcode: product.barcode } : sku ? { sku: sku.toUpperCase() } : { _id: null }).select("stock barcode purchaseType").lean();
      if (existing) {
        // A blank barcode cell doesn't wipe a barcode the product already has.
        // Same for a blank purchase type cell: keep what the product already has.
        const purchaseType = data.purchaseType?.trim() ? product.purchaseType : purchaseTypeOf(existing.purchaseType);
        await updateProduct(String(existing._id), { ...product, purchaseType, barcode: product.barcode || existing.barcode || "" });
        await Product.updateOne({ _id: existing._id }, { active: true });
        if (stock !== "") {
          const change = stockMode === "add" ? stock : stock - existing.stock;
          if (change !== 0) await changeStock(String(existing._id), change, stockMode === "add" ? "RESTOCK" : "ADJUSTMENT", { by, note: "CSV import", allowNegative: true });
        }
        results.push({ line, status: "updated", name: product.name });
      } else {
        await createProduct({ ...product, openingStock: stock === "" ? 0 : stock }, by);
        results.push({ line, status: "created", name: product.name });
      }
    } catch (e) {
      results.push({ line, status: "error", name, message: e instanceof StoreError ? e.message : "Couldn't save this row" });
    }
  }
  return results;
}
