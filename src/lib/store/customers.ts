// Customers are recognised by phone number, so a returning buyer's history stays in one place.
import "server-only";
import { Types } from "mongoose";
import { isId } from "../db";
import { Customer, Sale } from "./models";
import type { CustomerData } from "./schemas";

/** Last 10 digits, so "+91 98765-43210" and "09876543210" are the same customer. */
export const phoneKey = (phone: string) => phone.replace(/\D/g, "").slice(-10);

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Creates the customer, or updates the details of the one with the same phone number. */
export async function upsertCustomer(data: CustomerData) {
  const key = phoneKey(data.phone);
  const set: Record<string, string> = { name: data.name, phone: data.phone };
  // Blank optional fields don't wipe details saved on an earlier visit.
  for (const f of ["email", "address", "gstin", "stateName", "stateCode"] as const) if (data[f]) set[f] = data[f];
  return (await Customer.findOneAndUpdate({ phoneKey: key }, { $set: set, $setOnInsert: { phoneKey: key } }, { upsert: true, new: true }))!;
}

export async function searchCustomers(q: string, limit = 8) {
  const t = q.trim();
  if (!t) return [];
  const digits = t.replace(/\D/g, "");
  return Customer.find(digits.length >= 3 ? { phoneKey: new RegExp(escapeRx(digits)) } : { name: new RegExp(escapeRx(t), "i") })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
}

/** Bills and amount spent per customer (cancelled bills excluded). */
export async function customerTotals(ids?: string[]) {
  const rows = await Sale.aggregate<{ _id: Types.ObjectId; bills: number; spent: number; last: Date; units: number }>([
    { $match: { status: "PAID", customer: ids ? { $in: ids.filter(isId).map((i) => new Types.ObjectId(i)) } : { $exists: true } } },
    { $group: { _id: "$customer", bills: { $sum: 1 }, spent: { $sum: "$grandTotal" }, last: { $max: "$createdAt" }, units: { $sum: { $sum: "$items.qty" } } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r]));
}
