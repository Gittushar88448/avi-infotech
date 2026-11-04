// What goes on a printed bill. Shared by the settings page, the billing screen and the invoice.
//
// Two kinds of bill:
//   PLAIN  "Bill": prices only, no GST or licence details.
//   GST    "GST Bill" (tax invoice): GSTIN, state codes, HSN, CGST/SGST or IGST, HSN tax summary.
// Admins choose which optional sections appear on each kind in Bill settings.

export const BILL_TYPES = ["PLAIN", "GST"] as const;
export type BillType = (typeof BILL_TYPES)[number];
export const BILL_TYPE_LABEL: Record<BillType, string> = { PLAIN: "Bill", GST: "GST Bill" };
/** Bills saved before bill types existed were tax-invoice style. */
export const billTypeOf = (t?: string | null): BillType => (t === "PLAIN" ? "PLAIN" : "GST");

/**
 * How the shop bought a product: with a supplier's GST bill (input tax credit available) or on a
 * normal bill without GST. Used to filter the catalog and to warn when the bill type doesn't match.
 */
export const PURCHASE_TYPES = ["GST", "LOCAL"] as const;
export type PurchaseType = (typeof PURCHASE_TYPES)[number];
export const PURCHASE_LABEL: Record<PurchaseType, string> = { GST: "GST bill purchase", LOCAL: "Normal bill purchase (no GST)" };
export const PURCHASE_SHORT: Record<PurchaseType, string> = { GST: "GST bill", LOCAL: "Normal bill" };
/** Products saved before this field existed count as GST purchases. */
export const purchaseTypeOf = (t?: string | null): PurchaseType => (t === "LOCAL" ? "LOCAL" : "GST");
/** Reads CSV / form spellings: "gst", "GST bill", "local", "non gst", "without gst", "kaccha"... */
export function parsePurchaseType(v: unknown): PurchaseType | undefined {
  const s = String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return undefined;
  if (["local", "localbill", "normal", "normalbill", "nongst", "withoutgst", "nogst", "plain", "bill", "kaccha", "kachha", "cash"].includes(s)) return "LOCAL";
  if (["gst", "gstbill", "withgst", "taxinvoice", "invoice", "pakka", "pucca"].includes(s)) return "GST";
  return s as PurchaseType; // invalid: zod reports it
}

export const SECTIONS = [
  { key: "companyContact", label: "Company address, phone and email", plain: true, gst: true },
  { key: "companyTax", label: "Company GSTIN/UIN, PAN, state name & code, licence numbers", plain: false, gst: true },
  { key: "buyerContact", label: "Buyer's phone and email", plain: true, gst: true },
  { key: "buyerTax", label: "Buyer's GSTIN/UIN, state name & code", plain: false, gst: true },
  { key: "consignee", label: "Consignee (Ship to)", plain: false, gst: true },
  { key: "orderDetails", label: "Delivery note, order, dispatch and payment terms box", plain: false, gst: true },
  { key: "hsn", label: "HSN/SAC column", plain: false, gst: true },
  { key: "mrp", label: "MRP column", plain: true, gst: false },
  { key: "warranty", label: "Warranty under each item", plain: true, gst: true },
  { key: "amountInWords", label: "Amount in words", plain: true, gst: true },
  { key: "bankDetails", label: "Company's bank details", plain: false, gst: true },
  { key: "declaration", label: "Declaration", plain: false, gst: true },
  { key: "terms", label: "Terms & conditions", plain: true, gst: false },
  { key: "signature", label: "Authorised signatory", plain: true, gst: true },
] as const;
export type SectionKey = (typeof SECTIONS)[number]["key"];
export const defaultSections = (type: BillType): SectionKey[] => SECTIONS.filter((s) => (type === "GST" ? s.gst : s.plain)).map((s) => s.key);

/** Extra boxes printed on a GST invoice, Tally style. All optional, filled in per bill. */
export const DETAIL_FIELDS = [
  { key: "deliveryNote", label: "Delivery Note" },
  { key: "paymentTerms", label: "Mode/Terms of Payment" },
  { key: "referenceNo", label: "Reference No. & Date" },
  { key: "otherReferences", label: "Other References" },
  { key: "buyerOrderNo", label: "Buyer's Order No." },
  { key: "buyerOrderDate", label: "Dated" },
  { key: "dispatchDocNo", label: "Dispatch Doc No." },
  { key: "deliveryNoteDate", label: "Delivery Note Date" },
  { key: "dispatchedThrough", label: "Dispatched through" },
  { key: "destination", label: "Destination" },
  { key: "termsOfDelivery", label: "Terms of Delivery" },
] as const;
export type DetailKey = (typeof DETAIL_FIELDS)[number]["key"];
export type BillDetails = Partial<Record<DetailKey, string>>;

/** GST state codes (first two digits of a GSTIN). */
export const STATES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu & Kashmir" }, { code: "02", name: "Himachal Pradesh" }, { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" }, { code: "05", name: "Uttarakhand" }, { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" }, { code: "08", name: "Rajasthan" }, { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" }, { code: "11", name: "Sikkim" }, { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" }, { code: "14", name: "Manipur" }, { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" }, { code: "17", name: "Meghalaya" }, { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" }, { code: "20", name: "Jharkhand" }, { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" }, { code: "23", name: "Madhya Pradesh" }, { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu" }, { code: "27", name: "Maharashtra" }, { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" }, { code: "31", name: "Lakshadweep" }, { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" }, { code: "34", name: "Puducherry" }, { code: "35", name: "Andaman & Nicobar Islands" },
  { code: "36", name: "Telangana" }, { code: "37", name: "Andhra Pradesh" }, { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
];
export const stateByCode = (code?: string | null) => STATES.find((s) => s.code === code?.padStart(2, "0"));
/** "09ABCDE1234F1Z5" → Uttar Pradesh (09). */
export const stateFromGstin = (gstin?: string | null) => (gstin && /^\d{2}/.test(gstin) ? stateByCode(gstin.slice(0, 2)) : undefined);

/** Same state: CGST + SGST, half each. Different state: IGST. Unknown buyer state counts as local. */
export const isInterState = (sellerCode?: string | null, buyerCode?: string | null) => !!sellerCode && !!buyerCode && sellerCode !== buyerCode;
