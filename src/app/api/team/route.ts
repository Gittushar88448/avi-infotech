import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "@/lib/db";
import { apiSession } from "@/lib/auth";
import { fail, ok, parseJson } from "@/lib/api";

const Body = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(25).optional().default(""),
  role: z.enum(["TECHNICIAN", "ADMIN"]).default("TECHNICIAN"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export async function POST(req: Request) {
  if (!(await apiSession("ADMIN"))) return fail("Unauthorized", 401);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const { password, ...data } = parsed.data;
  if (await User.exists({ email: data.email })) return fail("Someone already uses that email");
  const user = await User.create({ ...data, phone: data.phone || undefined, passwordHash: await bcrypt.hash(password, 10) });
  return ok({ id: String(user._id) });
}
