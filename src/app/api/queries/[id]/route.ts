import { Query, Review, isId } from "@/lib/db";
import { apiSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const { id } = await params;
  if (!isId(id)) return fail("Not found", 404);
  await Promise.all([Query.deleteOne({ _id: id }), Review.deleteOne({ query: id })]);
  return ok();
}
