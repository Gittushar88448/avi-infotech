"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, KeyRound, Mail, Phone, Power, User, UserPlus, X } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { useToast } from "@/components/providers";
import { ActionButton } from "@/components/action-button";

export function AddMember() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("TECHNICIAN");
  const router = useRouter();
  const toast = useToast();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(new FormData(e.currentTarget)), role }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setOpen(false);
    toast({ kind: "success", title: "Team member added", body: "Share the email and password with them." });
    router.refresh();
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}><UserPlus /> Add member</button>
      {open && (
        <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <form className="dialog stack" onSubmit={onSubmit}>
            <h3 className="display" style={{ fontSize: 26 }}>Add a team member</h3>
            <div className="tabs" role="radiogroup">
              {[["TECHNICIAN", "Technician"], ["ADMIN", "Admin"]].map(([v, l]) => (
                <button type="button" key={v} className="tab" role="radio" aria-checked={role === v} data-active={role === v} style={{ border: 0, cursor: "pointer" }} onClick={() => setRole(v)}>{l}</button>
              ))}
            </div>
            {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
            <div className="field"><label className="label" htmlFor="m-name">Full name</label><div className="input-wrap"><User className="icon-left" /><input id="m-name" name="name" className="input" required autoFocus /></div></div>
            <div className="field"><label className="label" htmlFor="m-email">Email</label><div className="input-wrap"><Mail className="icon-left" /><input id="m-email" name="email" type="email" className="input" required /></div></div>
            <div className="field"><label className="label" htmlFor="m-phone">Phone</label><div className="input-wrap"><Phone className="icon-left" /><input id="m-phone" name="phone" type="tel" className="input" /></div></div>
            <PasswordInput name="password" label="Temporary password" autoComplete="new-password" showStrength />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : "Add member"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function MemberActions({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [resetOpen, setResetOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function savePassword() {
    setBusy(true);
    const res = await fetch(`/api/team/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast({ kind: "error", title: "Couldn't update password", body: data.error });
    toast({ kind: "success", title: "Password updated", body: `${name} has been signed out of other devices.` });
    setResetOpen(false);
    setPw("");
  }

  return (
    <div className="row wrap" style={{ marginTop: "auto" }}>
      <button className="btn btn-sm" onClick={() => setResetOpen(true)}><KeyRound /> Set password</button>
      <ActionButton url={`/api/team/${id}`} method="PATCH" body={{ active: !active }} className={`btn btn-sm ${active ? "btn-ghost" : ""}`} confirm={active ? `Disable ${name}? They'll be signed out and can't log in.` : undefined} success={active ? "Account disabled" : "Account enabled"}>
        <Power /> {active ? "Disable" : "Enable"}
      </ActionButton>
      {resetOpen && (
        <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && setResetOpen(false)}>
          <div className="dialog stack">
            <h3 className="display" style={{ fontSize: 24 }}>New password for {name}</h3>
            <PasswordInput name="newpw" label="New password" autoComplete="new-password" showStrength value={pw} onChange={setPw} />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setResetOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={savePassword} disabled={busy || pw.length < 8}>{busy ? <span className="spinner" /> : "Save password"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApprovalActions({ id, name }: { id: string; name: string }) {
  return (
    <div className="row wrap" style={{ marginTop: "auto" }}>
      <ActionButton url={`/api/team/${id}`} method="PATCH" body={{ approve: true }} className="btn btn-success btn-sm" success={`${name} can now sign in`}>
        <Check /> Approve
      </ActionButton>
      <ActionButton url={`/api/team/${id}`} method="DELETE" className="btn btn-ghost btn-sm" confirm={`Reject ${name}'s sign-up? Their account will be deleted.`} success="Sign-up rejected">
        <X /> Reject
      </ActionButton>
    </div>
  );
}
