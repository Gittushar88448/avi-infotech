import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { handle } from "@/lib/store/errors";
import { QuoteInput } from "@/lib/store/schemas";
import { QUOTE_STATUSES, type QuoteStatus } from "@/lib/store/models";
import { createQuote, listQuotes, quoteDTO } from "@/lib/store/quotes";

/** ?q= customer, phone, subject, product or QT number. ?status= DRAFT|SENT|ACCEPTED|REJECTED|CONVERTED */
export async function GET(req: Request) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const sp = new URL(req.url).searchParams;
  const status = (QUOTE_STATUSES as readonly string[]).includes(sp.get("status") ?? "") ? (sp.get("status") as QuoteStatus) : undefined;
  return ok({ items: (await listQuotes({ q: sp.get("q") ?? "", status })).map(quoteDTO) });
}

export async function POST(req: Request) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const parsed = await parseJson(req, QuoteInput);
  if ("error" in parsed) return parsed.error;
  return handle(async () => {
    const q = await createQuote(parsed.data, s.uid);
    return ok({ id: String(q._id) });
  });
}
