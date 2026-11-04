import { NextResponse } from "next/server";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "@/lib/db";

const Body = z.object({ token: z.string().min(10), password: z.string().min(8, "Use at least 8 characters.") });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const hash = createHash("sha256").update(parsed.data.token).digest("hex");
  const user = await User.findOne({ resetTokenHash: hash }).lean();
  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });
  }
  await User.updateOne(
    { _id: user._id },
    {
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      $unset: { resetTokenHash: 1, resetTokenExpiry: 1 },
      $inc: { sessionVersion: 1 }, // signs out every existing session
    },
  );
  return NextResponse.json({ ok: true });
}
