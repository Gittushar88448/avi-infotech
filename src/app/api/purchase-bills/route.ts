import { apiSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { handle } from "@/lib/store/errors";
import { PurchaseBillInput } from "@/lib/store/schemas";
import { parsePurchaseType } from "@/lib/store/bill-format";
import { createPurchaseBill, listPurchaseBills, purchaseBillDTO } from "@/lib/store/purchase-bills";

export const runtime = "nodejs";

/** Purchase bills, newest first. ?q= supplier / bill no., ?type=GST|LOCAL, ?limit= */
export async function GET(req: Request) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const sp = new URL(req.url).searchParams;
  const t = parsePurchaseType(sp.get("type"));
  const items = await listPurchaseBills({ q: sp.get("q") ?? "", type: t === "GST" || t === "LOCAL" ? t : undefined, limit: Math.min(Number(sp.get("limit")) || 200, 500) });
  return ok({ items });
}

/** Multipart form: billType, supplier, billNo, billDate (YYYY-MM-DD), amount (₹), notes, files (photos / PDFs). */
export async function POST(req: Request) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const form = await req.formData().catch(() => null);
  if (!form) return fail("Invalid form data");
  const fields = Object.fromEntries(["billType", "supplier", "billNo", "billDate", "amount", "notes"].map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = PurchaseBillInput.safeParse(fields);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid purchase bill");
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  return handle(async () => {
    const bill = await createPurchaseBill(parsed.data, files, s.uid);
    return ok({ id: String(bill._id), bill: purchaseBillDTO(bill.toObject()) });
  });
}
