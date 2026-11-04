import { z } from "zod";
import { Query, User, isId, nextQueryNumber } from "@/lib/db";
import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";
import { notify } from "@/lib/notify";
import { ticketCode } from "@/lib/format";

const Body = z.object({
  title: z.string().trim().min(3, "Add a short title").max(140),
  description: z.string().trim().min(3, "Describe the problem").max(4000),
  deviceType: z.string().trim().min(1).max(80),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  customerName: z.string().trim().min(1, "Customer name is required").max(120),
  customerPhone: z.string().trim().min(6, "Enter a valid phone number").max(25),
  siteAddress: z.string().trim().min(3, "Site address is required").max(400),
  scheduledFor: z.string().optional().nullable(),
  technicianIds: z.array(z.string()).min(1, "Pick at least one technician"),
});

export async function POST(req: Request) {
  const s = await apiSession("ADMIN");
  if (!s) return fail("Unauthorized", 401);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const { technicianIds, scheduledFor, ...data } = parsed.data;

  const techs = await User.find({ _id: { $in: technicianIds.filter(isId) }, role: "TECHNICIAN", active: true }).select("name").lean();
  if (techs.length === 0) return fail("Pick at least one active technician");

  const query = await Query.create({
    ...data,
    number: await nextQueryNumber(),
    scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    createdBy: s.uid,
    assignments: techs.map((t) => ({ user: t._id })),
    activities: [{ actor: s.uid, message: `Created and assigned to ${techs.map((t) => t.name).join(", ")}` }],
  });

  await notify(techs.map((t) => String(t._id)), {
    title: `New job ${ticketCode(query.number)}${query.priority === "URGENT" ? " · Urgent" : ""}`,
    body: `${query.title}, ${query.siteAddress}`,
    link: `/tech/jobs/${query._id}`,
  });
  return ok({ id: String(query._id) });
}
