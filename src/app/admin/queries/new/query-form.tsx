"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, MapPin, Phone, Send, User, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useToast } from "@/components/providers";

type Tech = { id: string; name: string; phone: string | null; open: number };
const DEVICES = ["CCTV camera", "IP camera", "DVR / NVR", "Video doorbell", "Biometric device", "Access control", "Alarm system", "Networking", "Other"];
const PRIORITIES = [
  { v: "LOW", l: "Low" },
  { v: "MEDIUM", l: "Medium" },
  { v: "HIGH", l: "High" },
  { v: "URGENT", l: "Urgent" },
];

export function QueryForm({ technicians }: { technicians: Tech[] }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [priority, setPriority] = useState("MEDIUM");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (selected.length === 0) return setError("Pick at least one technician to send this job to.");
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/queries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, priority, scheduledFor: f.scheduledFor || null, technicianIds: selected }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      return setError(data.error);
    }
    toast({ kind: "success", title: "Job dispatched", body: `${selected.length} technician${selected.length > 1 ? "s" : ""} notified` });
    router.push(`/admin/queries/${data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ "--gap": "18px" } as React.CSSProperties}>
      <section className="card stack">
        <span className="card-title">Customer</span>
        <div className="grid-2">
          <div className="field">
            <label className="label" htmlFor="customerName">Customer name</label>
            <div className="input-wrap"><User className="icon-left" /><input id="customerName" name="customerName" className="input" required placeholder="Rohan Mehta" /></div>
          </div>
          <div className="field">
            <label className="label" htmlFor="customerPhone">Phone number</label>
            <div className="input-wrap"><Phone className="icon-left" /><input id="customerPhone" name="customerPhone" type="tel" className="input" required placeholder="+91 98765 43210" /></div>
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="siteAddress">Site address</label>
          <div className="input-wrap"><MapPin className="icon-left" /><input id="siteAddress" name="siteAddress" className="input" required placeholder="Flat 302, Green Park, Sector 12, Noida" /></div>
        </div>
      </section>

      <section className="card stack">
        <span className="card-title">The problem</span>
        <div className="field">
          <label className="label" htmlFor="title">Short title</label>
          <input id="title" name="title" className="input" required maxLength={140} placeholder="Two cameras offline after power cut" />
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="label" htmlFor="deviceType">Device</label>
            <select id="deviceType" name="deviceType" className="select" defaultValue="CCTV camera">
              {DEVICES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="scheduledFor">Visit time <span className="muted">(optional)</span></label>
            <input id="scheduledFor" name="scheduledFor" type="datetime-local" className="input" />
          </div>
        </div>
        <div className="field">
          <span className="label">Priority</span>
          <div className="tabs" role="radiogroup">
            {PRIORITIES.map((p) => (
              <button
                type="button"
                key={p.v}
                role="radio"
                aria-checked={priority === p.v}
                className="tab"
                data-active={priority === p.v}
                onClick={() => setPriority(p.v)}
                style={{ border: 0, cursor: "pointer", ...(priority === p.v && p.v === "URGENT" ? { color: "var(--rose)" } : {}) }}
              >
                {p.l}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="description">Details</label>
          <textarea id="description" name="description" className="textarea" required placeholder="What did the customer report? Model numbers, access instructions, anything the technician should know." />
        </div>
      </section>

      <section className="card stack">
        <div className="row between">
          <span className="card-title">Send to technicians</span>
          <span className="muted" style={{ fontSize: 13, fontWeight: 650 }}>{selected.length} selected</span>
        </div>
        {technicians.length === 0 ? (
          <div className="alert alert-info">
            <UserPlus /> <span>You haven't added any technicians yet. <Link href="/admin/team" className="link-underline" style={{ fontWeight: 750 }}>Add your team</Link> first.</span>
          </div>
        ) : (
          <div className="row wrap" style={{ "--gap": "10px" } as React.CSSProperties}>
            {technicians.map((t) => (
              <button type="button" key={t.id} className="chip" aria-pressed={selected.includes(t.id)} onClick={() => toggle(t.id)}>
                <Avatar name={t.name} size={28} />
                {t.name}
                <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{t.open ? `${t.open} open` : "free"}</span>
                <Check className="check" />
              </button>
            ))}
          </div>
        )}
      </section>

      {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? <span className="spinner" /> : <><Send /> Dispatch job</>}
        </button>
      </div>
    </form>
  );
}
