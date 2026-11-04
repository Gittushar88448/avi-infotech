import { Query, isId } from "@/lib/db";
import { apiSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { saveImage } from "@/lib/storage";
import { adminIds, broadcastRefresh, notify } from "@/lib/notify";
import { ticketCode } from "@/lib/format";

export const runtime = "nodejs";

/** Technician submits proof of completion: photos + confirmed customer details. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("TECHNICIAN");
  if (!s) return fail("Unauthorized", 401);
  const { id } = await params;
  if (!isId(id)) return fail("Not found", 404);
  const q = await Query.findOne({ _id: id, "assignments.user": s.uid });
  if (!q) return fail("This job isn't assigned to you", 403);
  if (!["ASSIGNED", "IN_PROGRESS", "REWORK"].includes(q.status)) return fail("This job has already been submitted");

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Invalid form data");
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const customerName = str("customerName");
  const customerPhone = str("customerPhone");
  const customerAddress = str("customerAddress");
  const notes = str("notes").slice(0, 4000);
  if (!customerName || !customerAddress) return fail("Customer name and address are required");
  if (customerPhone.replace(/\D/g, "").length < 6) return fail("Enter a valid customer phone number");

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return fail("Add at least one photo of the completed work");
  if (files.length > 12) return fail("Up to 12 photos per submission");

  let photos: string[];
  try {
    photos = await Promise.all(files.map(saveImage));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Upload failed");
  }

  q.submissions.push({ technician: s.uid, customerName, customerPhone, customerAddress, notes, photos });
  q.status = "SUBMITTED";
  q.activities.push({ actor: s.uid, message: `${s.name} submitted the work with ${photos.length} photo${photos.length > 1 ? "s" : ""}` });
  await q.save();

  await notify(await adminIds(), { title: `${ticketCode(q.number)} ready for review`, body: `${s.name} finished “${q.title}”`, link: `/admin/queries/${id}` });
  await broadcastRefresh(id);
  return ok();
}
