import { randomBytes } from "crypto";
import { Query, isId } from "@/lib/db";
import { apiSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { broadcastRefresh, logActivity, notify } from "@/lib/notify";
import { ticketCode } from "@/lib/format";
import { sendReviewSms } from "@/lib/review-sms";

/** Admin verifies the submitted work, closes the query and texts the customer a review link. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const { id } = await params;
  if (!isId(id)) return fail("Not found", 404);
  // Only one admin can flip SUBMITTED -> COMPLETED, so the SMS is never sent twice.
  const q = await Query.findOneAndUpdate(
    { _id: id, status: "SUBMITTED" },
    { status: "COMPLETED", completedAt: new Date(), reviewToken: randomBytes(18).toString("base64url") },
    { new: true },
  ).lean();
  if (!q) return fail("Only submitted work can be marked complete");

  const sms = await sendReviewSms(id);
  await logActivity(id, s.uid, `Verified and marked complete. Review SMS ${sms.ok ? "sent" : `failed: ${sms.error}`}`);
  await notify(q.assignments.map((a) => String(a.user)), { title: `${ticketCode(q.number)} approved`, body: `Your work on “${q.title}” was verified. Nice job!`, link: `/tech/jobs/${id}` });
  await broadcastRefresh(id);
  return ok({ sms });
}
