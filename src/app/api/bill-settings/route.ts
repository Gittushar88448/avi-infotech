import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { BillSettingsInput } from "@/lib/store/schemas";
import { getBillSettings, saveBillSettings } from "@/lib/store/bill-settings";

export async function GET() {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  return ok(await getBillSettings());
}

/** Saves the shop's bill details. Bills already made keep the details they were printed with. */
export async function PUT(req: Request) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const parsed = await parseJson(req, BillSettingsInput);
  if ("error" in parsed) return parsed.error;
  await saveBillSettings(parsed.data);
  return ok(await getBillSettings());
}
