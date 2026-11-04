"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadLeaflet, type LMap, type LMarker, type LPolyline, type Leaflet } from "./leaflet-loader";
import { Crosshair, Navigation, Phone, Route } from "lucide-react";
import { useToast } from "@/components/providers";
import { Avatar } from "@/components/ui";
import { initials, timeAgo } from "@/lib/format";
import type { TeamLocation } from "@/lib/location";

const LIVE_MS = 3 * 60 * 1000;
const INDIA: [number, number] = [22.6, 79.0];

const isLive = (t: TeamLocation) => !!t.location && Date.now() - new Date(t.location.at).getTime() < LIVE_MS;

export function TrackingSwitch({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  useEffect(() => setOn(enabled), [enabled]);

  async function toggle() {
    const next = !on;
    if (!next && !window.confirm("Switch off live location? Technicians will stop sharing their location and won't be asked for it at sign in.")) return;
    setBusy(true);
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationTracking: next }) });
    setBusy(false);
    if (!res.ok) return toast({ kind: "error", title: "Couldn't change the setting" });
    setOn(next);
    toast({ kind: "success", title: next ? "Live location switched on" : "Live location switched off", body: next ? "Technicians must allow location to use the app." : "Technicians are no longer tracked." });
    router.refresh();
  }

  return (
    <button type="button" role="switch" aria-checked={on} className="switch-row" onClick={toggle} disabled={busy}>
      <span className="switch" data-on={on}><span /></span>
      <span className="stack" style={{ "--gap": "2px", textAlign: "left" } as React.CSSProperties}>
        <strong style={{ fontSize: 14.5 }}>Live location {on ? "on" : "off"}</strong>
        <span className="hint">{on ? "Technicians must allow location to sign in" : "Technicians aren't asked for location"}</span>
      </span>
    </button>
  );
}

export function LiveMap({ initialTeam, enabled }: { initialTeam: TeamLocation[]; enabled: boolean }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const L = useRef<Leaflet | null>(null);
  const map = useRef<LMap | null>(null);
  const markers = useRef(new Map<string, LMarker>());
  const line = useRef<LPolyline | null>(null);
  const [mapError, setMapError] = useState("");
  const [team, setTeam] = useState(initialTeam);
  const [selected, setSelected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [clock, tick] = useState(0);

  useEffect(() => setTeam(initialTeam), [initialTeam]);

  // Create the map once (Leaflet needs the browser, so it's loaded here rather than imported at the top).
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((lib) => {
      if (cancelled || !box.current || map.current) return;
      L.current = lib;
      map.current = L.current.map(box.current, { zoomControl: true }).setView(INDIA, 5);
      L.current
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" })
        .addTo(map.current);
      setReady(true);
    }, (e: Error) => setMapError(e.message));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
  }, []);

  // Keep a marker per technician in step with the data.
  useEffect(() => {
    const Lf = L.current;
    const m = map.current;
    if (!ready || !Lf || !m) return;
    for (const t of team) {
      if (!t.location) continue;
      const icon = Lf.divIcon({
        className: "",
        html: `<div class="map-pin" data-live="${isLive(t)}" data-selected="${selected === t.id}"><span>${initials(t.name)}</span></div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });
      const existing = markers.current.get(t.id);
      if (existing) {
        existing.setLatLng([t.location.lat, t.location.lng]).setIcon(icon);
      } else {
        const mk = Lf.marker([t.location.lat, t.location.lng], { icon, title: t.name }).addTo(m);
        mk.on("click", () => setSelected(t.id));
        markers.current.set(t.id, mk);
      }
      markers.current.get(t.id)!.bindTooltip(`${t.name} · ${isLive(t) ? "live" : `seen ${timeAgo(t.location.at)}`}`);
    }
  }, [team, ready, selected, clock]);

  // Fit everyone on screen the first time.
  const fitted = useRef(false);
  useEffect(() => {
    if (!ready || fitted.current || !L.current || !map.current) return;
    const pts = team.filter((t) => t.location).map((t) => [t.location!.lat, t.location!.lng] as [number, number]);
    if (pts.length === 1) map.current.setView(pts[0]!, 15);
    else if (pts.length > 1) map.current.fitBounds(L.current.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
    fitted.current = true;
  }, [ready, team]);

  // Live updates pushed by the server, plus a slow refresh in case a push is missed.
  useEffect(() => {
    const onLive = (ev: Event) => {
      const e = (ev as CustomEvent).detail;
      if (e?.type === "location") {
        setTeam((all) => all.map((t) => (t.id === e.userId ? { ...t, location: { lat: e.lat, lng: e.lng, accuracy: e.accuracy, at: e.at } } : t)));
      }
    };
    window.addEventListener("live-event", onLive);
    const poll = setInterval(async () => {
      const res = await fetch("/api/location", { cache: "no-store" });
      if (res.ok) setTeam((await res.json()).team);
    }, 60_000);
    const clock = setInterval(() => tick((n) => n + 1), 20_000);
    return () => {
      window.removeEventListener("live-event", onLive);
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [router]);

  // The selected technician's route over the last 12 hours.
  useEffect(() => {
    line.current?.remove();
    line.current = null;
    if (!selected || !ready || !L.current || !map.current) return;
    const t = team.find((x) => x.id === selected);
    if (t?.location) map.current.setView([t.location.lat, t.location.lng], Math.max(map.current.getZoom(), 15));
    let cancelled = false;
    fetch(`/api/location/${selected}?hours=12`)
      .then((r) => (r.ok ? r.json() : { points: [] }))
      .then(({ points }: { points: { lat: number; lng: number }[] }) => {
        if (cancelled || !L.current || !map.current || points.length < 2) return;
        line.current = L.current.polyline(points.map((p) => [p.lat, p.lng] as [number, number]), { color: "#4f46e5", weight: 4, opacity: 0.7 }).addTo(map.current);
      });
    return () => {
      cancelled = true;
    };
    // Only when the selection changes; new points arrive as marker moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, ready]);

  const live = team.filter(isLive).length;
  const sorted = [...team].sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || (b.location?.at ?? "").localeCompare(a.location?.at ?? ""));

  return (
    <div className="map-layout">
      <div className="card map-card">
        <div ref={box} className="map-box" />
        {mapError && <div className="map-note">{mapError}. Refresh the page to try again.</div>}
        {!enabled && <div className="map-note">Live location is off. Showing last known positions.</div>}
      </div>
      <div className="card stack" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row between" style={{ padding: "16px 18px 0" }}>
          <span className="card-title">Team</span>
          <span className="badge badge-COMPLETED"><span className="dot" />{live} live</span>
        </div>
        {team.length === 0 ? (
          <div className="empty" style={{ padding: 30 }}>No active technicians yet.</div>
        ) : (
          <div className="stack" style={{ "--gap": "0px", maxHeight: 560, overflowY: "auto" } as React.CSSProperties}>
            {sorted.map((t) => (
              <div key={t.id} className="map-person" data-selected={selected === t.id}>
                <button type="button" className="row grow" style={{ border: 0, background: "none", padding: 0, cursor: t.location ? "pointer" : "default", textAlign: "left", font: "inherit", color: "inherit" }} onClick={() => t.location && setSelected(t.id)}>
                  <span style={{ position: "relative" }}>
                    <Avatar name={t.name} size={36} />
                    <span className="presence" data-live={isLive(t)} />
                  </span>
                  <span className="stack grow" style={{ "--gap": "2px" } as React.CSSProperties}>
                    <strong style={{ fontSize: 14.5 }}>{t.name}</strong>
                    <span className="hint">
                      {!t.location ? "No location yet" : isLive(t) ? `Live · within ${t.location.accuracy || "?"} m` : `Last seen ${timeAgo(t.location.at)}`}
                    </span>
                  </span>
                </button>
                {t.location && (
                  <div className="row" style={{ "--gap": "2px" } as React.CSSProperties}>
                    <button type="button" className="icon-btn" title="Show on map and today's route" onClick={() => setSelected(t.id)}>{selected === t.id ? <Route /> : <Crosshair />}</button>
                    <a className="icon-btn" title="Directions in Google Maps" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${t.location.lat},${t.location.lng}`}><Navigation /></a>
                    {t.phone && <a className="icon-btn" title={`Call ${t.phone}`} href={`tel:${t.phone}`}><Phone /></a>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
