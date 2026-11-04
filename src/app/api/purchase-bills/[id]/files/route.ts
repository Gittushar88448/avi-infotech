import { apiSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { handle } from "@/lib/store/errors";
import { addBillFiles } from "@/lib/store/purchase-bills";

export const runtime = "nodejs";

/** Attach more photos / PDFs to a purchase bill (e.g. the second page, or a bill scanned later). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const form = await req.formData().catch(() => null);
  if (!form) return fail("Invalid form data");
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const { id } = await params;
  return handle(async () => {
    await addBillFiles(id, files);
    return ok();
  });
}
