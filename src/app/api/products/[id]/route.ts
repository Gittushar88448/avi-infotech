import { z } from "zod";
import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { handle } from "@/lib/store/errors";
import { ProductInput } from "@/lib/store/schemas";
import { setProductActive, updateProduct } from "@/lib/store/products";

const Body = z.union([z.object({ active: z.boolean() }).strict(), ProductInput]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const { id } = await params;
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const data = parsed.data;
  return handle(async () => {
    if ("name" in data) await updateProduct(id, data);
    else await setProductActive(id, data.active);
    return ok();
  });
}
