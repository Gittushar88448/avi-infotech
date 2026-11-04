import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { Notification, isId } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await apiSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [items, unread] = await Promise.all([
    Notification.find({ user: s.uid }).sort({ createdAt: -1 }).limit(25).lean(),
    Notification.countDocuments({ user: s.uid, read: false }),
  ]);
  return NextResponse.json({
    items: items.map((n) => ({ id: String(n._id), title: n.title, body: n.body, link: n.link ?? null, read: n.read, createdAt: n.createdAt })),
    unread,
  });
}

/** Marks one notification ({id}) or all of them ({all: true}) as read. */
export async function POST(req: Request) {
  const s = await apiSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };
  if (!body.all && !isId(body.id)) return NextResponse.json({ ok: true });
  await Notification.updateMany({ user: s.uid, ...(body.all ? {} : { _id: body.id }) }, { read: true });
  return NextResponse.json({ ok: true });
}
