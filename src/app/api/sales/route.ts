import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { handle } from "@/lib/store/errors";
import { SaleInput } from "@/lib/store/schemas";
import { createSale } from "@/lib/store/sales";

export async function POST(req: Request) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const parsed = await parseJson(req, SaleInput);
  if ("error" in parsed) return parsed.error;
  return handle(async () => {
    const sale = await createSale(parsed.data, s.uid);
    return ok({ id: String(sale._id), number: sale.number });
  });
}
