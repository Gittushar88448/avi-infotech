import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { User } from "@/lib/db";
import { sendEmail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { appUrl } from "@/lib/format";

export async function POST(req: Request) {
  const parsed = z.object({ email: z.string().email() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const email = parsed.data.email.toLowerCase().trim();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`forgot:${ip}`, 5)) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });

  const user = await User.findOne({ email }).lean();
  let devLink: string | undefined;
  if (user && user.active) {
    const token = randomBytes(32).toString("hex");
    await User.updateOne(
      { _id: user._id },
      { resetTokenHash: createHash("sha256").update(token).digest("hex"), resetTokenExpiry: new Date(Date.now() + 30 * 60 * 1000) },
    );
    const link = `${appUrl()}/reset-password/${token}`;
    await sendEmail(
      user.email,
      "Reset your password",
      `Hi ${user.name},\n\nUse this link to set a new password. It expires in 30 minutes.\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
      `<p>Hi ${user.name},</p><p>Use the button below to set a new password. It expires in 30 minutes.</p><p><a href="${link}" style="background:#0a6c96;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block">Reset password</a></p><p>If you didn't ask for this, you can ignore this email.</p>`,
    );
    // Without a real email provider the link is shown on screen during development.
    if (process.env.NODE_ENV !== "production" && (process.env.EMAIL_PROVIDER || "console") === "console") devLink = link;
  }
  // Same response whether or not the account exists, so emails can't be probed.
  return NextResponse.json({ ok: true, devLink });
}
