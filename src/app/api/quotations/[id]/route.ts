import { z } from "zod";
import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { isId } from "@/lib/db";
import { handle } from "@/lib/store/errors";
import { QuoteInput } from "@/lib/store/schemas";
import { QUOTE_STATUSES, Quotation } from "@/lib/store/models";
import { deleteQuote, quoteDTO, setQuoteStatus, updateQuote } from "@/lib/store/quotes";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const { id } = await params;
  const q = isId(id) ? await Quotation.findById(id).lean() : null;
  if (!q) return fail("Quotation not found", 404);
  return ok({ quote: quoteDTO(q) });
}

/** Replace the quotation's contents (customer, lines, terms). */
export async function PUT(req: Request, { params }: Ctx) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const parsed = await parseJson(req, QuoteInput);
  if ("error" in parsed) return parsed.error;
  const { id } = await params;
  return handle(async () => {
    await updateQuote(id, parsed.data);
    return ok({ id });
  });
}

/** Change status: SENT, ACCEPTED, REJECTED or back to DRAFT. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const parsed = await parseJson(req, z.object({ status: z.enum(QUOTE_STATUSES) }));
  if ("error" in parsed) return parsed.error;
  const { id } = await params;
  return handle(async () => {
    await setQuoteStatus(id, parsed.data.status);
    return ok();
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const { id } = await params;
  return handle(async () => {
    await deleteQuote(id);
    return ok();
  });
}
