// Mongoose models for the shop: catalog, customers, sales (bills) and the stock ledger.
//
//   categories ──< products ──< stock_movements      every stock change is a ledger row
//                     │
//   customers  ──< sales (items[] → product)         sale lines keep a snapshot of the product
//
// Amounts are integers in paise (see money.ts).
import { Schema, Types } from "mongoose";
import { getModel } from "../db";
import { PAYMENT_MODES, type PaymentMode } from "./money";
import { BILL_TYPES, type BillDetails, type BillType, type SectionKey } from "./bill-format";

const { ObjectId } = Schema.Types;
type Id = Types.ObjectId;

export interface ICategory { name: string; createdAt: Date; updatedAt: Date }
export interface IProduct {
  name: string;
  /** Code printed on the box. Optional: products without one are found by SKU or name. */
  barcode?: string;
  /** Our own code, generated for every product (AVI-00001). */
  sku: string;
  category: Id | string;
  brand: string;
  model: string;
  description: string;
  unit: string;
  hsn: string;
  mrp: number;
  /** Default selling price, GST inclusive. Usually the MRP or a little below. */
  price: number;
  costPrice: number;
  gstRate: number;
  stock: number;
  lowStockAt: number;
  warrantyMonths: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface ICustomer {
  name: string;
  phone: string;
  /** Last 10 digits of the phone, used to recognise a returning customer. */
  phoneKey: string;
  email: string;
  address: string;
  gstin: string;
  stateName: string;
  stateCode: string;
  createdAt: Date;
  updatedAt: Date;
}
/** Party details as printed on a bill (buyer or consignee). */
export interface IParty { name: string; phone: string; email: string; address: string; gstin: string; stateName: string; stateCode: string }
/** The shop's own details, editable in Bill settings and copied onto each bill when it's made. */
export interface ISeller {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  pan: string;
  stateName: string;
  stateCode: string;
  licences: string;
  bankHolder: string;
  bankName: string;
  bankAccount: string;
  bankBranchIfsc: string;
  declaration: string;
  terms: string;
}
export interface IBillSettings extends ISeller {
  _id: string;
  plainSections: SectionKey[];
  gstSections: SectionKey[];
  updatedAt: Date;
}
export interface ISaleItem {
  _id?: Id;
  product: Id | string;
  name: string;
  barcode?: string;
  sku: string;
  category: string;
  hsn: string;
  unit?: string;
  warrantyMonths: number;
  qty: number;
  mrp: number;
  unitPrice: number;
  discount: number;
  gstRate: number;
  taxable: number;
  tax: number;
  total: number;
}
export interface ISale {
  number: number;
  /** PLAIN bills and GST bills are numbered separately (BILL-00001, INV-00001). Missing on old bills = GST. */
  billType?: BillType;
  status: "PAID" | "CANCELLED";
  customer?: Id | string;
  /** Copy of the customer's details at the time of sale, so old bills never change. */
  customerSnapshot: Partial<IParty> & { name: string };
  /** Ship-to party when different from the buyer. */
  consignee?: Partial<IParty>;
  /** Shop details as they were when the bill was made. */
  seller?: Partial<ISeller>;
  details?: BillDetails;
  /** IGST instead of CGST + SGST (buyer in another state). */
  interState?: boolean;
  items: ISaleItem[];
  gross: number;
  discount: number;
  taxable: number;
  tax: number;
  roundOff: number;
  grandTotal: number;
  paymentMode: PaymentMode;
  notes: string;
  soldBy: Id | string;
  cancelledAt?: Date;
  cancelledBy?: Id | string;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
export const MOVEMENT_REASONS = ["OPENING", "RESTOCK", "SALE", "SALE_CANCELLED", "ADJUSTMENT", "DAMAGED", "RETURN"] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];
export interface IStockMovement {
  product: Id | string;
  /** Positive adds stock, negative removes it. */
  change: number;
  balanceAfter: number;
  reason: MovementReason;
  sale?: Id | string;
  note: string;
  by?: Id | string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Categories ──────────────────────────────────────
const categorySchema = new Schema<ICategory>(
  { name: { type: String, required: true, trim: true } },
  { timestamps: true },
);
categorySchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

// ── Products ────────────────────────────────────────
const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true },
    sku: { type: String, required: true, unique: true },
    category: { type: ObjectId, ref: "Category", required: true },
    brand: { type: String, default: "", trim: true },
    model: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    unit: { type: String, default: "pcs" },
    hsn: { type: String, default: "" },
    mrp: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    gstRate: { type: Number, default: 18, min: 0, max: 28 },
    stock: { type: Number, default: 0 },
    lowStockAt: { type: Number, default: 3, min: 0 },
    warrantyMonths: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
productSchema.index({ barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: "string" } } });
productSchema.index({ category: 1, name: 1 });
productSchema.index({ active: 1, stock: 1 });

// ── Customers ───────────────────────────────────────
const customerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    phoneKey: { type: String, required: true, unique: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    address: { type: String, default: "", trim: true },
    gstin: { type: String, default: "", trim: true, uppercase: true },
    stateName: { type: String, default: "" },
    stateCode: { type: String, default: "" },
  },
  { timestamps: true },
);
customerSchema.index({ name: 1 });

// ── Bill settings (one document) ────────────────────
const sellerFields = {
  companyName: { type: String, default: "" },
  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  email: { type: String, default: "" },
  gstin: { type: String, default: "" },
  pan: { type: String, default: "" },
  stateName: { type: String, default: "" },
  stateCode: { type: String, default: "" },
  licences: { type: String, default: "" },
  bankHolder: { type: String, default: "" },
  bankName: { type: String, default: "" },
  bankAccount: { type: String, default: "" },
  bankBranchIfsc: { type: String, default: "" },
  declaration: { type: String, default: "" },
  terms: { type: String, default: "" },
};
const billSettingsSchema = new Schema<IBillSettings>(
  { _id: { type: String, required: true }, ...sellerFields, plainSections: { type: [String], default: undefined }, gstSections: { type: [String], default: undefined } },
  { timestamps: { createdAt: false, updatedAt: true } },
);
const partySchema = new Schema<IParty>(
  { name: String, phone: String, email: String, address: String, gstin: String, stateName: String, stateCode: String },
  { _id: false },
);

// ── Sales (bills) ───────────────────────────────────
const saleItemSchema = new Schema<ISaleItem>({
  product: { type: ObjectId, ref: "Product", required: true },
  name: { type: String, required: true },
  barcode: { type: String },
  sku: { type: String, required: true },
  category: { type: String, default: "" },
  hsn: { type: String, default: "" },
  unit: { type: String, default: "pcs" },
  warrantyMonths: { type: Number, default: 0 },
  qty: { type: Number, required: true, min: 1 },
  mrp: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  gstRate: { type: Number, required: true },
  taxable: { type: Number, required: true },
  tax: { type: Number, required: true },
  total: { type: Number, required: true },
});

const saleSchema = new Schema<ISale>(
  {
    number: { type: Number, required: true },
    billType: { type: String, enum: BILL_TYPES, default: "GST" },
    status: { type: String, enum: ["PAID", "CANCELLED"], default: "PAID" },
    customer: { type: ObjectId, ref: "Customer" },
    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      address: { type: String, default: "" },
      gstin: { type: String, default: "" },
      stateName: { type: String, default: "" },
      stateCode: { type: String, default: "" },
    },
    consignee: { type: partySchema },
    seller: { type: new Schema(sellerFields, { _id: false }) },
    details: { type: Schema.Types.Mixed, default: undefined },
    interState: { type: Boolean, default: false },
    items: { type: [saleItemSchema], required: true },
    gross: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxable: { type: Number, required: true },
    tax: { type: Number, required: true },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    paymentMode: { type: String, enum: PAYMENT_MODES, default: "CASH" },
    notes: { type: String, default: "" },
    soldBy: { type: ObjectId, ref: "User", required: true },
    cancelledAt: { type: Date },
    cancelledBy: { type: ObjectId, ref: "User" },
    cancelReason: { type: String },
  },
  { timestamps: true },
);
saleSchema.index({ createdAt: -1 });
// Numbers are unique within each bill type.
saleSchema.index({ billType: 1, number: 1 }, { unique: true });
saleSchema.index({ customer: 1, createdAt: -1 });
saleSchema.index({ "items.product": 1, createdAt: -1 });

// ── Stock ledger ────────────────────────────────────
const stockMovementSchema = new Schema<IStockMovement>(
  {
    product: { type: ObjectId, ref: "Product", required: true },
    change: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, enum: MOVEMENT_REASONS, required: true },
    sale: { type: ObjectId, ref: "Sale" },
    note: { type: String, default: "" },
    by: { type: ObjectId, ref: "User" },
  },
  { timestamps: true },
);
stockMovementSchema.index({ product: 1, createdAt: -1 });

export const Category = getModel<ICategory>("Category", categorySchema, "categories");
export const Product = getModel<IProduct>("Product", productSchema, "products");
export const Customer = getModel<ICustomer>("Customer", customerSchema, "customers");
export const Sale = getModel<ISale>("Sale", saleSchema, "sales");
export const BillSettings = getModel<IBillSettings>("BillSettings", billSettingsSchema, "bill_settings");
export const StockMovement = getModel<IStockMovement>("StockMovement", stockMovementSchema, "stock_movements");
