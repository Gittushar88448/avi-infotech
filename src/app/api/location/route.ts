import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { LocationInput, isTrackingOn, recordLocation, teamLocations } from "@/lib/location";

/** Technician's browser reports its position. Answers enabled:false when an admin has switched sharing off. */
export async function POST(req: Request) {
  const s = await apiSession("TECHNICIAN");
  if (!s) return fail("Unauthorized", 401);
  if (!(await isTrackingOn())) return ok({ enabled: false });
  const parsed = await parseJson(req, LocationInput);
  if ("error" in parsed) return parsed.error;
  await recordLocation(s.uid, parsed.data);
  return ok({ enabled: true });
}

/** Latest position of every technician, for the admin map. */
export async function GET() {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const [enabled, team] = await Promise.all([isTrackingOn(), teamLocations()]);
  return ok({ enabled, team });
}
