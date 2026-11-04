import { z } from "zod";
import { Review, isId } from "@/lib/db";
import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";

/** Admin hides or re-publishes a review on the public page. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const parsed = await parseJson(req, z.object({ published: z.boolean() }));
  if ("error" in parsed) return parsed.error;
  const { id } = await params;
  if (!isId(id)) return fail("Not found", 404);
  await Review.updateOne({ _id: id }, { published: parsed.data.published });
  return ok();
}
