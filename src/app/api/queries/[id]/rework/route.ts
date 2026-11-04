import { z } from "zod";
import { Query, isId } from "@/lib/db";
import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { broadcastRefresh, notify } from "@/lib/notify";
import { ticketCode } from "@/lib/format";

/** Admin sends submitted work back to the technicians with a note. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const { id } = await params;
  if (!isId(id)) return fail("Not found", 404);
  const parsed = await parseJson(req, z.object({ note: z.string().trim().min(3, "Tell the technician what to fix").max(1000) }));
  if ("error" in parsed) return parsed.error;

  const q = await Query.findOneAndUpdate(
    { _id: id, status: "SUBMITTED" },
    { status: "REWORK", $push: { activities: { actor: s.uid, message: `Sent back for rework: ${parsed.data.note}` } } },
    { new: true },
  ).lean();
  if (!q) return fail("Only submitted work can be sent back");

  await notify(q.assignments.map((a) => String(a.user)), { title: `${ticketCode(q.number)} needs rework`, body: parsed.data.note, link: `/tech/jobs/${id}` });
  await broadcastRefresh(id);
  return ok();
}
