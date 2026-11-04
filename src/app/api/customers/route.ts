import { apiSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { searchCustomers } from "@/lib/store/customers";

/** Finds returning customers by phone digits or name, for the billing screen. */
export async function GET(req: Request) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const rows = await searchCustomers(new URL(req.url).searchParams.get("q") ?? "");
  return ok({ items: rows.map((c) => ({ id: String(c._id), name: c.name, phone: c.phone, email: c.email, address: c.address, gstin: c.gstin, stateName: c.stateName ?? "", stateCode: c.stateCode ?? "" })) });
}
