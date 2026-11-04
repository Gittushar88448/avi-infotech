import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { adminIds, notify } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(25),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

/**
 * Self sign-up. The very first account becomes the admin and is signed in right away.
 * Everyone after that joins as a technician and waits for an admin to approve them.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`signup:${ip}`, 5)) return NextResponse.json({ error: "Too many sign-ups from this network. Try again later." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { password, ...data } = parsed.data;

  if (await User.exists({ email: data.email })) {
    return NextResponse.json({ error: "An account with this email already exists. Try signing in or resetting your password." }, { status: 409 });
  }
  const first = (await User.estimatedDocumentCount()) === 0;
  const user = await User.create({
    ...data,
    passwordHash: await bcrypt.hash(password, 10),
    role: first ? "ADMIN" : "TECHNICIAN",
    active: first,
    pendingApproval: !first,
  });

  if (first) {
    await createSession(user);
    return NextResponse.json({ status: "signed_in", redirect: "/admin" });
  }
  await notify(await adminIds(), { title: "New sign-up to approve", body: `${user.name} (${user.email}) wants to join as a technician`, link: "/admin/team" });
  return NextResponse.json({ status: "pending" });
}
