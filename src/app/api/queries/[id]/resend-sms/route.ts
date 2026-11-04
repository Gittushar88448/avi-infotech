import { Query, Review, isId } from "@/lib/db";
import { apiSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { logActivity } from "@/lib/notify";
import { sendReviewSms } from "@/lib/review-sms";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const { id } = await params;
  if (!isId(id)) return fail("Not found", 404);
  const q = await Query.findById(id).select("status").lean();
  if (!q || q.status !== "COMPLETED") return fail("Query isn't completed");
  if (await Review.exists({ query: id })) return fail("The customer has already left a review");
  const sms = await sendReviewSms(id);
  await logActivity(id, s.uid, `Review SMS resent${sms.ok ? "" : ` (failed: ${sms.error})`}`);
  return ok({ sms });
}
