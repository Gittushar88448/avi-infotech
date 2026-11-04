import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { handle } from "@/lib/store/errors";
import { CancelSaleInput } from "@/lib/store/schemas";
import { cancelSale } from "@/lib/store/sales";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const { id } = await params;
  const parsed = await parseJson(req, CancelSaleInput);
  if ("error" in parsed) return parsed.error;
  return handle(async () => {
    await cancelSale(id, s.uid, parsed.data.reason);
    return ok();
  });
}
