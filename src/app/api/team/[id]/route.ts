import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, isId } from "@/lib/db";
import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { notify } from "@/lib/notify";

const Body = z.object({
  active: z.boolean().optional(),
  approve: z.literal(true).optional(),
  password: z.string().min(8, "Use at least 8 characters").optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const { id } = await params;
  if (!isId(id)) return fail("Not found", 404);
  if (id === s.uid) return fail("You can't change your own account here");
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const { active, password, approve } = parsed.data;
  if (approve) {
    const res = await User.updateOne({ _id: id, pendingApproval: true }, { active: true, pendingApproval: false });
    if (!res.modifiedCount) return fail("This sign-up was already handled");
    await notifyApproved(id);
    return ok();
  }
  // Either change signs the member out everywhere.
  await User.updateOne(
    { _id: id },
    {
      ...(active !== undefined && { active }),
      ...(password && { passwordHash: await bcrypt.hash(password, 10) }),
      $inc: { sessionVersion: 1 },
    },
  );
  return ok();
}

/** Rejects a pending sign-up by deleting it. Approved accounts are disabled instead, never deleted. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const { id } = await params;
  if (!isId(id)) return fail("Not found", 404);
  const res = await User.deleteOne({ _id: id, pendingApproval: true });
  if (!res.deletedCount) return fail("Only pending sign-ups can be rejected");
  return ok();
}

async function notifyApproved(id: string) {
  await notify([id], { title: "Welcome aboard!", body: "Your account was approved. New jobs assigned to you will show up here.", link: "/tech" });
}
