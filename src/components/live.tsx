"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck, Inbox } from "lucide-react";
import { useToast } from "./providers";
import { timeAgo } from "@/lib/format";

type Notif = { id: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.14 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.14);
      o.stop(ctx.currentTime + i * 0.14 + 0.55);
    });
  } catch {}
}

/** Notification bell + live connection. Lives in the app shell top bar. */
export function LiveBell() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [ring, setRing] = useState(0);
  const [connected, setConnected] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const boxRef = useRef<HTMLDivElement>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items);
    setUnread(data.unread);
  }, []);

  const softRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 250);
  }, [router]);

  useEffect(() => {
    load();
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    const es = new EventSource("/api/stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (msg) => {
      const e = JSON.parse(msg.data);
      if (e.type === "notification") {
        const n = e.notification;
        setItems((all) => [{ ...n, read: false }, ...all].slice(0, 25));
        setUnread((u) => u + 1);
        setRing((r) => r + 1);
        chime();
        toast({ title: n.title, body: n.body, href: n.link ?? undefined });
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
          const sys = new Notification(n.title, { body: n.body, tag: n.id });
          sys.onclick = () => { window.focus(); if (n.link) router.push(n.link); };
        }
        softRefresh();
      } else if (e.type === "refresh" || e.type === "tracking") {
        softRefresh();
      }
      // Lets other components (the live map, the location gate) react without opening another connection.
      window.dispatchEvent(new CustomEvent("live-event", { detail: e }));
    };
    return () => es.close();
  }, [load, router, softRefresh, toast]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function markAll() {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    setItems((all) => all.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  async function openOne(n: Notif) {
    setOpen(false);
    if (!n.read) {
      fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) });
      setItems((all) => all.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.link) router.push(n.link);
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }} className="row">
      <span
        title={connected ? "Live updates on" : "Reconnecting…"}
        style={{ width: 8, height: 8, borderRadius: 9, background: connected ? "var(--green)" : "var(--muted)", boxShadow: connected ? "0 0 0 4px var(--green-soft)" : undefined, transition: "all .3s" }}
      />
      <button key={ring} className={`icon-btn ${ring ? "bell-ring" : ""}`} style={{ position: "relative" }} onClick={() => setOpen((o) => !o)} aria-label={`Notifications, ${unread} unread`}>
        {unread ? <BellRing /> : <Bell />}
        {unread > 0 && <span className="bell-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="row between" style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={markAll}><CheckCheck /> Mark all read</button>
            )}
          </div>
          {perm === "default" && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ margin: 10, width: "calc(100% - 20px)", background: "var(--accent-soft)", color: "var(--accent)" }}
              onClick={async () => setPerm(await Notification.requestPermission())}
            >
              <BellRing /> Turn on desktop alerts
            </button>
          )}
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {items.length === 0 ? (
              <div className="empty" style={{ padding: 36 }}>
                <div className="empty-icon"><Inbox /></div>
                You're all caught up.
              </div>
            ) : (
              items.map((n) => (
                <button key={n.id} className="notif" onClick={() => openOne(n)} style={{ width: "100%", textAlign: "left", background: "none", border: 0, borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                  <span className={n.read ? "" : "unread"} />
                  <span className="stack" style={{ "--gap": "2px" } as React.CSSProperties}>
                    <strong style={{ fontSize: 14 }}>{n.title}</strong>
                    <span className="text-2" style={{ fontSize: 13.5 }}>{n.body}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
