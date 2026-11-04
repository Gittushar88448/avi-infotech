import { apiSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { isId } from "@/lib/db";
import { trail } from "@/lib/location";

/** A technician's route over the last few hours (default 12, at most 72). */
export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const { userId } = await params;
  if (!isId(userId)) return fail("Not found", 404);
  const hours = Math.min(72, Math.max(1, Number(new URL(req.url).searchParams.get("hours")) || 12));
  return ok({ points: await trail(userId, hours) });
}
