import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { ImportInput } from "@/lib/store/schemas";
import { importProducts } from "@/lib/store/products";

/** Bulk create/update from a CSV. The browser sends up to 500 rows per request. */
export async function POST(req: Request) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const parsed = await parseJson(req, ImportInput);
  if ("error" in parsed) return parsed.error;
  return ok({ results: await importProducts(parsed.data.rows, parsed.data.stockMode, s.uid) });
}
