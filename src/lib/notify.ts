import "server-only";
import { Notification, Query, User } from "./db";
import { emitToUser } from "./events";

export async function notify(userIds: string[], n: { title: string; body: string; link?: string }) {
  const unique = [...new Set(userIds.map(String))];
  for (const userId of unique) {
    const row = await Notification.create({ user: userId, title: n.title, body: n.body, link: n.link });
    emitToUser(userId, {
      type: "notification",
      notification: { id: String(row._id), title: row.title, body: row.body, link: row.link ?? null, createdAt: row.createdAt.toISOString() },
    });
  }
}

export async function adminIds() {
  const admins = await User.find({ role: "ADMIN", active: true }).select("_id").lean();
  return admins.map((a) => String(a._id));
}

/** Tells everyone involved in a query to refresh their view, without a notification. */
export async function broadcastRefresh(queryId: string) {
  const [q, admins] = await Promise.all([Query.findById(queryId).select("assignments.user").lean(), adminIds()]);
  const assigned = q?.assignments.map((a) => String(a.user)) ?? [];
  for (const id of new Set([...assigned, ...admins])) emitToUser(id, { type: "refresh", queryId });
}

export async function logActivity(queryId: string, actorId: string | null, message: string) {
  await Query.updateOne({ _id: queryId }, { $push: { activities: { actor: actorId ?? undefined, message } } });
}
