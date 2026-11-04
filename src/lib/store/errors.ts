import "server-only";
import { fail } from "../api";

/** A business-rule failure with a message that is safe to show the user (out of stock, duplicate barcode, ...). */
export class StoreError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Runs a route handler body and turns a StoreError or a duplicate-key error into a JSON error response. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof StoreError) return fail(e.message, e.status);
    const dup = e as { code?: number; keyPattern?: Record<string, unknown> };
    if (dup.code === 11000) {
      const field = Object.keys(dup.keyPattern ?? {})[0];
      return fail(field === "barcode" ? "Another product already has this barcode" : field === "phoneKey" ? "A customer with this phone number already exists" : "That already exists", 409);
    }
    throw e;
  }
}
