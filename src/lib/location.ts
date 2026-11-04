// Live location of technicians. The technician's browser reports its position while they're
// signed in; admins see the latest position on a map. Admins can switch the whole feature off.
import "server-only";
import { z } from "zod";
import { LocationPing, Settings, User } from "./db";
import { emitToUser } from "./events";
import { adminIds } from "./notify";

/** A point older than this is shown as "last seen" rather than live. */
export const LIVE_WINDOW_MS = 3 * 60 * 1000;
/** History points closer together in time than this are skipped (the live position still updates). */
const HISTORY_EVERY_MS = 20 * 1000;

export const LocationInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000).default(0),
  heading: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
});
export type LocationData = z.infer<typeof LocationInput>;

export async function isTrackingOn() {
  const s = await Settings.findById("app").select("locationTracking").lean();
  return s?.locationTracking ?? true;
}

export async function setTracking(enabled: boolean, by: string) {
  await Settings.updateOne({ _id: "app" }, { locationTracking: enabled, updatedBy: by }, { upsert: true });
  // Technicians' screens start or stop sharing straight away.
  const techs = await User.find({ role: "TECHNICIAN", active: true }).select("_id").lean();
  for (const t of techs) emitToUser(String(t._id), { type: "tracking", enabled });
  for (const id of await adminIds()) emitToUser(id, { type: "refresh" });
}

/** Saves a position for a technician and pushes it to admins' maps. */
export async function recordLocation(userId: string, loc: LocationData) {
  const at = new Date();
  const prev = await User.findByIdAndUpdate(userId, { lastLocation: { ...loc, at } }).select("lastLocation.at").lean();
  if (!prev?.lastLocation?.at || at.getTime() - new Date(prev.lastLocation.at).getTime() >= HISTORY_EVERY_MS) {
    await LocationPing.create({ user: userId, lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy });
  }
  const event = { type: "location" as const, userId, lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, at: at.toISOString() };
  for (const id of await adminIds()) emitToUser(id, event);
}

/** Every active technician with their latest position (if any), for the admin map. */
export async function teamLocations() {
  const users = await User.find({ role: "TECHNICIAN", active: true, pendingApproval: false }).sort({ name: 1 }).select("name phone lastLocation").lean();
  return users.map((u) => ({
    id: String(u._id),
    name: u.name,
    phone: u.phone ?? null,
    location: u.lastLocation?.at
      ? { lat: u.lastLocation.lat, lng: u.lastLocation.lng, accuracy: u.lastLocation.accuracy, at: new Date(u.lastLocation.at).toISOString() }
      : null,
  }));
}
export type TeamLocation = Awaited<ReturnType<typeof teamLocations>>[number];

export async function trail(userId: string, hours = 12) {
  const since = new Date(Date.now() - hours * 3600_000);
  const pts = await LocationPing.find({ user: userId, createdAt: { $gte: since } }).sort({ createdAt: 1 }).limit(2000).select("lat lng createdAt").lean();
  return pts.map((p) => ({ lat: p.lat, lng: p.lng, at: p.createdAt.toISOString() }));
}
