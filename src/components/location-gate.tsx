"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, MapPinOff, RotateCw } from "lucide-react";
import { GEO_HELP, geoFailure, toPosition, tryCloseApp, type GeoFailure, type Position } from "@/lib/geo";

const SEND_EVERY_MS = 30_000;
const SEND_IF_MOVED_M = 25;
const HEARTBEAT_MS = 60_000;

/** Distance in metres between two points (haversine). */
function metres(a: Position, b: Position) {
  const r = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/**
 * Shares the technician's location while they're signed in, when the admin has location
 * sharing switched on. If location permission is taken away, the technician is signed out and
 * the app tries to close. Shows a small "Location on" chip in the top bar so it's never hidden.
 */
export function LocationGate({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"starting" | "on" | GeoFailure>("starting");
  const last = useRef<{ pos: Position; sentAt: number } | null>(null);
  const latest = useRef<Position | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;

    async function signOutBlocked() {
      if (stopped) return;
      stopped = true;
      await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
      tryCloseApp();
      window.location.href = "/login?location=off";
    }

    async function send(pos: Position) {
      last.current = { pos, sentAt: Date.now() };
      const res = await fetch("/api/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pos) }).catch(() => null);
      if (res?.status === 401) window.location.href = "/login";
      const data = res?.ok ? await res.json().catch(() => ({})) : {};
      if (data.enabled === false) router.refresh();
    }

    function onPosition(p: GeolocationPosition) {
      const pos = toPosition(p);
      latest.current = pos;
      setState("on");
      const prev = last.current;
      if (!prev || Date.now() - prev.sentAt >= SEND_EVERY_MS || metres(prev.pos, pos) >= SEND_IF_MOVED_M) send(pos);
    }

    function onError(e: GeolocationPositionError) {
      const reason = geoFailure(e);
      if (reason === "denied") return void signOutBlocked();
      setState(reason);
    }

    if (!window.isSecureContext) {
      setState("insecure");
      return;
    }
    if (!("geolocation" in navigator)) {
      setState("unsupported");
      return;
    }

    const watch = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 });
    // A phone that isn't moving may not report new positions, so repeat the last one to show it's still live.
    const beat = setInterval(() => {
      if (latest.current && (!last.current || Date.now() - last.current.sentAt >= HEARTBEAT_MS)) send(latest.current);
    }, 15_000);
    const onVisible = () => document.visibilityState === "visible" && latest.current && send(latest.current);
    document.addEventListener("visibilitychange", onVisible);

    // Permission switched off in browser or phone settings while the app is open.
    let perm: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        perm = p;
        p.onchange = () => p.state === "denied" && signOutBlocked();
        if (p.state === "denied") signOutBlocked();
      })
      .catch(() => {});

    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watch);
      clearInterval(beat);
      document.removeEventListener("visibilitychange", onVisible);
      if (perm) perm.onchange = null;
    };
  }, [enabled, router]);

  if (!enabled) return null;

  if (state !== "on" && state !== "starting") {
    const help = GEO_HELP[state];
    return (
      <div className="dialog-backdrop" style={{ zIndex: 200 }}>
        <div className="dialog stack" role="alertdialog" aria-labelledby="geo-title">
          <div className="empty-icon" style={{ background: "var(--rose-soft)", color: "var(--rose)", animation: "none" }}><MapPinOff /></div>
          <h3 id="geo-title" className="display" style={{ fontSize: 24 }}>{help.title}</h3>
          <p className="text-2">{help.body}</p>
          <p className="hint">The app stays locked until your location is available again.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}><RotateCw /> Try again</button>
        </div>
      </div>
    );
  }

  return (
    <span className="pill hide-sm-inline" title="Your admin can see your location while you're signed in" style={{ height: 30, paddingLeft: 10, fontSize: 12.5 }}>
      <MapPin style={{ width: 14, color: state === "on" ? "var(--green)" : "var(--muted)" }} />
      {state === "on" ? "Location on" : "Finding location…"}
    </span>
  );
}
