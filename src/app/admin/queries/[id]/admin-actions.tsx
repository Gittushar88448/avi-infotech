"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, RotateCcw, X } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useToast } from "@/components/providers";

export function ReworkButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  async function send() {
    setBusy(true);
    const res = await fetch(`/api/queries/${id}/rework`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast({ kind: "error", title: "Couldn't send back", body: data.error });
    setOpen(false);
    toast({ kind: "success", title: "Sent back to technicians" });
    router.refresh();
  }
  return (
    <>
      <button className="btn btn-danger" onClick={() => setOpen(true)}><RotateCcw /> Send back</button>
      {open && (
        <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="dialog stack">
            <h3 className="display" style={{ fontSize: 24 }}>What needs fixing?</h3>
            <p className="text-2">The assigned technicians get this note right away.</p>
            <textarea className="textarea" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Photo of the NVR screen is missing, please re-check camera 3 angle." />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={send} disabled={busy || note.trim().length < 3}>{busy ? <span className="spinner" /> : "Send back"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AssignEditor({ id, all, assigned, locked }: { id: string; all: { id: string; name: string }[]; assigned: string[]; locked: boolean }) {
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState(assigned);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  async function save() {
    setBusy(true);
    const res = await fetch(`/api/queries/${id}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ technicianIds: sel }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast({ kind: "error", title: "Couldn't update", body: data.error });
    setEditing(false);
    toast({ kind: "success", title: "Technicians updated" });
    router.refresh();
  }
  if (!editing) {
    return locked ? null : (
      <button className="btn btn-ghost btn-sm" onClick={() => { setSel(assigned); setEditing(true); }}><Pencil /> Edit</button>
    );
  }
  return (
    <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && setEditing(false)}>
      <div className="dialog stack">
        <h3 className="display" style={{ fontSize: 24 }}>Assigned technicians</h3>
        <div className="row wrap" style={{ "--gap": "8px" } as React.CSSProperties}>
          {all.map((t) => (
            <button key={t.id} type="button" className="chip" aria-pressed={sel.includes(t.id)} onClick={() => setSel((s) => (s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id]))}>
              <Avatar name={t.name} size={26} /> {t.name} <Check className="check" />
            </button>
          ))}
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={() => setEditing(false)}><X /> Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || sel.length === 0}>{busy ? <span className="spinner" /> : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
