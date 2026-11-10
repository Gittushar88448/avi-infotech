import { apiSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { handle } from "@/lib/store/errors";
import { duplicateQuote } from "@/lib/store/quotes";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const { id } = await params;
  return handle(async () => ok({ id: String((await duplicateQuote(id, s.uid))._id) }));
}
