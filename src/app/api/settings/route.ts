import { z } from "zod";
import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { setTracking } from "@/lib/location";

const Body = z.object({ locationTracking: z.boolean() });

export async function PATCH(req: Request) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  await setTracking(parsed.data.locationTracking, s.uid);
  return ok({ locationTracking: parsed.data.locationTracking });
}
