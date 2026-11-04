import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { isId } from "@/lib/db";
import { handle } from "@/lib/store/errors";
import { StockInput } from "@/lib/store/schemas";
import { changeStock } from "@/lib/store/products";

/** Restock, return, damage or manual correction. Sales change stock on their own. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const { id } = await params;
  if (!isId(id)) return fail("Product not found", 404);
  const parsed = await parseJson(req, StockInput);
  if ("error" in parsed) return parsed.error;
  const { change, reason, note } = parsed.data;
  // A correction may take stock below zero if the count was wrong; other removals may not.
  return handle(async () => ok({ stock: await changeStock(id, change, reason, { by: s.uid, note, allowNegative: reason === "ADJUSTMENT" }) }));
}
