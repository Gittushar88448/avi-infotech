import { z } from "zod";
import { Query, User, isId } from "@/lib/db";
import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { broadcastRefresh, logActivity, notify } from "@/lib/notify";
import { ticketCode } from "@/lib/format";

/** Replaces the set of technicians on a query. Newly added technicians are notified. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const { id } = await params;
  if (!isId(id)) return fail("Not found", 404);
  const parsed = await parseJson(req, z.object({ technicianIds: z.array(z.string()).min(1, "Keep at least one technician") }));
  if ("error" in parsed) return parsed.error;

  const query = await Query.findById(id);
  if (!query) return fail("Query not found", 404);
  if (query.status === "COMPLETED") return fail("This query is already completed");

  const techs = await User.find({ _id: { $in: parsed.data.technicianIds.filter(isId) }, role: "TECHNICIAN", active: true }).select("name").lean();
  if (techs.length === 0) return fail("Keep at least one technician");
  const current = new Set(query.assignments.map((a) => String(a.user)));
  const wanted = new Set(techs.map((t) => String(t._id)));
  const added = techs.filter((t) => !current.has(String(t._id)));
  const removed = [...current].filter((u) => !wanted.has(u));

  query.set(
    "assignments",
    [...query.assignments.filter((a) => wanted.has(String(a.user))), ...added.map((t) => ({ user: t._id }))],
  );
  await query.save();

  if (added.length) {
    await logActivity(id, s.uid, `Assigned ${added.map((t) => t.name).join(", ")}`);
    await notify(added.map((t) => String(t._id)), { title: `New job ${ticketCode(query.number)}`, body: `${query.title}, ${query.siteAddress}`, link: `/tech/jobs/${id}` });
  }
  if (removed.length) await logActivity(id, s.uid, `Removed ${removed.length} technician${removed.length > 1 ? "s" : ""}`);
  await broadcastRefresh(id);
  return ok();
}
