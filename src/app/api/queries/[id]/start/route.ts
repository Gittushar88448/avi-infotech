import { Query, isId } from "@/lib/db";
import { apiSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { adminIds, broadcastRefresh, notify } from "@/lib/notify";
import { ticketCode } from "@/lib/format";

/** Technician accepts the job and heads to site. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("TECHNICIAN");
  if (!s) return fail("Unauthorized", 401);
  const { id } = await params;
  if (!isId(id)) return fail("Not found", 404);
  const q = await Query.findOne({ _id: id, "assignments.user": s.uid });
  if (!q) return fail("This job isn't assigned to you", 403);
  if (!["ASSIGNED", "REWORK", "IN_PROGRESS"].includes(q.status)) return fail("This job can't be started now");

  const mine = q.assignments.find((a) => String(a.user) === s.uid)!;
  if (!mine.acceptedAt) mine.acceptedAt = new Date();
  q.status = "IN_PROGRESS";
  q.activities.push({ actor: s.uid, message: `${s.name} accepted the job and is heading to site` });
  await q.save();

  await notify(await adminIds(), { title: `${ticketCode(q.number)} in progress`, body: `${s.name} accepted “${q.title}”`, link: `/admin/queries/${id}` });
  await broadcastRefresh(id);
  return ok();
}
