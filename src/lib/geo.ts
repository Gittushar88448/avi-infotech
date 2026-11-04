// Browser geolocation helpers, shared by the login form and the technician's location gate.

export type Position = { lat: number; lng: number; accuracy: number; heading: number | null; speed: number | null };
export type GeoFailure = "denied" | "unavailable" | "timeout" | "unsupported" | "insecure";

export const toPosition = (p: GeolocationPosition): Position => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: Math.round(p.coords.accuracy),
  heading: p.coords.heading,
  speed: p.coords.speed,
});

export const geoFailure = (e: GeolocationPositionError): GeoFailure => (e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable");

/** Asks for permission (the browser shows its prompt the first time) and returns one position. */
export function getPosition(): Promise<{ ok: true; position: Position } | { ok: false; reason: GeoFailure }> {
  if (typeof window !== "undefined" && !window.isSecureContext) return Promise.resolve({ ok: false, reason: "insecure" });
  if (!("geolocation" in navigator)) return Promise.resolve({ ok: false, reason: "unsupported" });
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ ok: true, position: toPosition(p) }),
      (e) => resolve({ ok: false, reason: geoFailure(e) }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    ),
  );
}

export const GEO_HELP: Record<GeoFailure, { title: string; body: string }> = {
  denied: {
    title: "Location access is blocked",
    body: "This app needs your location while you're signed in. Tap the lock icon next to the web address, set Location to Allow, then try again.",
  },
  unavailable: { title: "Can't find your location", body: "Turn on GPS / Location on your phone, then try again." },
  timeout: { title: "Finding your location took too long", body: "Move near a window or outdoors, check GPS is on, and try again." },
  unsupported: { title: "This browser can't share location", body: "Open the app in Chrome or Safari on your phone." },
  insecure: { title: "Location needs a secure (https) link", body: "Ask your admin for the https:// address of the app. Browsers only share location over https." },
};

/** Tries to close the app window. Browsers only allow this for installed apps or windows opened by script. */
export function tryCloseApp() {
  try {
    window.close();
  } catch {}
}
