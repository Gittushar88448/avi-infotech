import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { handle } from "@/lib/store/errors";
import { NewProductInput } from "@/lib/store/schemas";
import { parsePurchaseType } from "@/lib/store/bill-format";
import { createProduct, findByCode, productDTO, searchProducts } from "@/lib/store/products";

/**
 * Product search for the billing screen (name, brand, model, SKU or barcode).
 * ?all=1 returns the whole catalog (up to 1000) for the product picker; ?cat= filters by category id.
 */
export async function GET(req: Request) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const sp = new URL(req.url).searchParams;
  const products = await searchProducts(sp.get("q") ?? "", { limit: sp.get("all") ? 1000 : 20, categoryId: sp.get("cat") ?? undefined, purchaseType: parsePurchaseType(sp.get("pt")) });
  return ok({ items: products.map(productDTO) });
}

export async function POST(req: Request) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const parsed = await parseJson(req, NewProductInput);
  if ("error" in parsed) return parsed.error;
  return handle(async () => {
    const p = await createProduct(parsed.data, s.uid);
    const fresh = await findByCode(p.sku);
    return ok({ id: String(p._id), product: fresh ? productDTO(fresh) : null });
  });
}
