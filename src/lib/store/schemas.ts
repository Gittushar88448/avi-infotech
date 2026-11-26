// Request validation for the shop API. Forms send rupees; these schemas convert them to paise.
import { z } from "zod";
import { MOVEMENT_REASONS } from "./models";
import { PAYMENT_MODES, toPaise } from "./money";
import { BILL_TYPES, DETAIL_FIELDS, PURCHASE_TYPES, SECTIONS, parsePurchaseType, type SectionKey } from "./bill-format";

const rupees = (label: string) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number` }).min(0, `${label} can't be negative`).max(10_000_000).transform(toPaise);
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const wholeNumber = (label: string, min = 0) => z.coerce.number().int(`${label} must be a whole number`).min(min).max(1_000_000);

export const ProductInput = z
  .object({
    name: z.string().trim().min(2, "Product name is required").max(160),
    barcode: z.string().trim().max(64).optional().default(""),
    categoryName: z.string().trim().min(1, "Pick or type a category").max(60),
    brand: optionalText(60),
    model: optionalText(80),
    description: optionalText(1000),
    unit: z.string().trim().max(12).optional().default("pcs"),
    hsn: optionalText(12),
    mrp: rupees("MRP"),
    price: rupees("Selling price").optional(),
    costPrice: rupees("Cost price").optional().default(0),
    gstRate: z.coerce.number().min(0).max(28).default(18),
    purchaseType: z.preprocess(parsePurchaseType, z.enum(PURCHASE_TYPES, { errorMap: () => ({ message: "Purchase type is GST or Local" }) }).default("GST")),
    lowStockAt: wholeNumber("Low stock alert").default(3),
    warrantyMonths: wholeNumber("Warranty").default(0),
  })
  .transform((p) => ({ ...p, price: p.price || p.mrp }))
  .refine((p) => p.price <= p.mrp, { message: "Selling price can't be more than the MRP", path: ["price"] });

const billId = z.union([z.literal(""), z.string().regex(/^[a-f\d]{24}$/i, "Unknown purchase bill")]).optional().default("");
export const NewProductInput = z.intersection(ProductInput, z.object({ openingStock: wholeNumber("Opening stock").default(0), purchaseBillId: billId }));

export const StockInput = z.object({
  change: z.coerce.number().int("Quantity must be a whole number").refine((n) => n !== 0, "Enter a quantity").refine((n) => Math.abs(n) <= 100_000, "That quantity is too large"),
  reason: z.enum(MOVEMENT_REASONS).refine((r) => r !== "SALE" && r !== "SALE_CANCELLED", "Sales change stock automatically"),
  note: optionalText(300),
  purchaseBillId: billId,
});

/** A quotation as the builder sends it. Prices are negotiable here (no MRP cap), lines may be custom. */
export const QuoteInput = z.object({
  quoteType: z.enum(BILL_TYPES).default("GST"),
  subject: optionalText(160),
  customer: z.object({
    name: z.string().trim().min(1, "Customer name is required").max(120),
    phone: optionalText(25),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional().default(""),
    address: optionalText(400),
    gstin: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^[0-9A-Z]{15}$/, "GSTIN is 15 letters and digits")]).optional().default(""),
    stateName: optionalText(60),
    stateCode: z.union([z.literal(""), z.string().trim().regex(/^\d{1,2}$/, "State code is 2 digits")]).optional().default(""),
  }),
  customerId: z.union([z.literal(""), z.string().regex(/^[a-f\d]{24}$/i)]).optional().default(""),
  items: z
    .array(
      z.object({
        productId: z.union([z.literal(""), z.string().regex(/^[a-f\d]{24}$/i, "Unknown product")]).optional().default(""),
        name: z.string().trim().min(1, "Every line needs a name").max(200),
        description: optionalText(500),
        hsn: optionalText(12),
        unit: z.string().trim().max(12).optional().default("pcs"),
        qty: wholeNumber("Quantity", 1),
        unitPrice: rupees("Price"),
        discount: rupees("Discount").optional().default(0),
        gstRate: z.coerce.number().min(0).max(28).default(18),
      }),
    )
    .min(1, "Add at least one product to the quotation")
    .max(300),
  validUntil: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Valid-until date looks wrong")]).optional().default(""),
  notes: optionalText(1000),
  terms: optionalText(2000),
});
export type QuoteData = z.infer<typeof QuoteInput>;

/** Text fields of a purchase bill upload (sent as multipart form data along with the files). */
export const PurchaseBillInput = z
  .object({
    billType: z.preprocess(parsePurchaseType, z.enum(PURCHASE_TYPES, { errorMap: () => ({ message: "Choose GST or Without GST" }) })),
    supplier: optionalText(120),
    billNo: optionalText(60),
    billDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bill date looks wrong")]).optional().default(""),
    amount: z.union([z.literal(""), rupees("Bill amount")]).optional().default(""),
    notes: optionalText(500),
  })
  .transform((b) => ({ ...b, amount: b.amount === "" ? 0 : b.amount, billDate: b.billDate ? new Date(`${b.billDate}T00:00:00`) : undefined }));
export type PurchaseBillData = z.infer<typeof PurchaseBillInput>;

export const CustomerInput = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(120),
  phone: z.string().trim().max(25).refine((p) => p.replace(/\D/g, "").length >= 10, "Enter a 10 digit phone number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional().default(""),
  address: optionalText(400),
  gstin: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^[0-9A-Z]{15}$/, "GSTIN is 15 letters and digits")]).optional().default(""),
  stateName: optionalText(60),
  stateCode: z.union([z.literal(""), z.string().trim().regex(/^\d{1,2}$/, "State code is 2 digits")]).optional().default(""),
});

/** Ship-to party on a GST bill. Phone is optional here. */
export const ConsigneeInput = z.object({
  name: z.string().trim().min(1, "Consignee name is required").max(120),
  address: optionalText(400),
  gstin: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^[0-9A-Z]{15}$/, "Consignee GSTIN is 15 letters and digits")]).optional().default(""),
  stateName: optionalText(60),
  stateCode: z.union([z.literal(""), z.string().trim().regex(/^\d{1,2}$/, "State code is 2 digits")]).optional().default(""),
  phone: optionalText(25),
});

const sectionList = z.array(z.string()).transform((keys) => keys.filter((k): k is SectionKey => SECTIONS.some((s) => s.key === k)));
export const BillSettingsInput = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(120),
  address: optionalText(500),
  phone: optionalText(80),
  email: optionalText(120),
  gstin: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^[0-9A-Z]{15}$/, "GSTIN is 15 letters and digits")]).optional().default(""),
  pan: optionalText(20),
  stateName: optionalText(60),
  stateCode: z.union([z.literal(""), z.string().trim().regex(/^\d{1,2}$/, "State code is 2 digits")]).optional().default(""),
  licences: optionalText(500),
  bankHolder: optionalText(120),
  bankName: optionalText(120),
  bankAccount: optionalText(40),
  bankBranchIfsc: optionalText(120),
  declaration: optionalText(800),
  terms: optionalText(800),
  plainSections: sectionList,
  gstSections: sectionList,
});
export type BillSettingsData = z.infer<typeof BillSettingsInput>;

export const SaleInput = z.object({
  /** Leave out for a walk-in customer who doesn't want to share details. */
  customer: CustomerInput.nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().regex(/^[a-f\d]{24}$/i, "Unknown product"),
        qty: wholeNumber("Quantity", 1),
        unitPrice: rupees("Price"),
        discount: rupees("Discount").optional().default(0),
      }),
    )
    .min(1, "Scan or add at least one product")
    .max(200),
  paymentMode: z.enum(PAYMENT_MODES),
  notes: optionalText(500),
  billType: z.enum(BILL_TYPES).default("PLAIN"),
  /** Set when the bill is made from a quotation; the quotation is then marked as billed. */
  quoteId: z.union([z.literal(""), z.string().regex(/^[a-f\d]{24}$/i)]).optional().default(""),
  /** Ship-to party; leave out when goods go to the buyer. */
  consignee: ConsigneeInput.nullable().optional().default(null),
  details: z
    .object(Object.fromEntries(DETAIL_FIELDS.map((f) => [f.key, optionalText(200)])) as Record<(typeof DETAIL_FIELDS)[number]["key"], ReturnType<typeof optionalText>>)
    .partial()
    .optional()
    .default({}),
});

export const CancelSaleInput = z.object({ reason: z.string().trim().min(3, "Say why the bill is being cancelled").max(300) });

export type ProductData = z.infer<typeof ProductInput>;
export type CustomerData = z.infer<typeof CustomerInput>;
export type SaleData = z.infer<typeof SaleInput>;

/** One CSV row, after the browser has matched the columns. Blank stock leaves an existing product's stock alone. */
export const ImportRow = z.intersection(
  ProductInput,
  z.object({
    sku: z.string().trim().max(40).optional().default(""),
    stock: z.union([z.literal(""), z.coerce.number().int("Stock must be a whole number").min(0, "Stock can't be negative").max(1_000_000)]).optional().default(""),
  }),
);
export const ImportInput = z.object({
  /** "set": the stock column is the current count. "add": it's quantity received, added to what's there. */
  stockMode: z.enum(["set", "add"]),
  rows: z.array(z.object({ line: z.number().int(), data: z.record(z.string()) })).min(1).max(500),
});
export type ImportRowData = z.infer<typeof ImportRow>;
