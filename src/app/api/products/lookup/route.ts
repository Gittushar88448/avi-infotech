import { apiSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { findByCode, productDTO } from "@/lib/store/products";

/** Exact barcode / SKU lookup. Called on every scan. */
export async function GET(req: Request) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const code = new URL(req.url).searchParams.get("code") ?? "";
  const p = await findByCode(code);
  if (!p) return fail("No product with this barcode", 404);
  return ok({ product: productDTO(p) });
}
