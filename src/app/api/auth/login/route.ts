import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { LocationInput, isTrackingOn, recordLocation } from "@/lib/location";

const Body = z.object({ email: z.string().email(), password: z.string().min(1), location: LocationInput.nullable().optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  const email = parsed.data.email.toLowerCase().trim();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`login:${ip}:${email}`, 8)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const user = await User.findOne({ email }).lean();
  const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) return NextResponse.json({ error: "That email and password don't match." }, { status: 401 });
  if (user.pendingApproval) return NextResponse.json({ error: "Your account is waiting for admin approval. You'll be able to sign in once it's approved." }, { status: 403 });
  if (!user.active) return NextResponse.json({ error: "This account has been disabled. Contact your administrator." }, { status: 403 });
  // With location sharing on, a technician gets in only after their browser has shared a position.
  // 428 tells the login form to ask for location permission and send the sign-in again.
  if (user.role === "TECHNICIAN" && (await isTrackingOn())) {
    if (!parsed.data.location) return NextResponse.json({ locationRequired: true, error: "Allow location access to sign in." }, { status: 428 });
    await recordLocation(String(user._id), parsed.data.location);
  }
  await createSession(user);
  return NextResponse.json({ redirect: user.role === "ADMIN" ? "/admin" : "/tech" });
}
