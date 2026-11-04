"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Hourglass, Mail, Phone, User } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { HoverLetters } from "@/components/fancy-text";

export default function SignupPage() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pw !== confirm) return setError("The two passwords don't match.");
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: f.get("name"), email: f.get("email"), phone: f.get("phone"), password: pw }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    if (data.status === "signed_in") window.location.href = data.redirect;
    else setPending(true);
  }

  if (pending) {
    return (
      <AuthShell>
        <div className="stack" style={{ "--gap": "14px" } as React.CSSProperties}>
          <div className="empty-icon"><Hourglass /></div>
          <h2 className="display" style={{ fontSize: 34 }}>You're on the list</h2>
          <p className="text-2">Your account was created. An administrator has been notified and needs to approve it before you can sign in.</p>
          <Link href="/login" className="btn btn-primary btn-lg btn-block">Back to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} className="stack" style={{ "--gap": "18px" } as React.CSSProperties}>
        <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
          <span className="eyebrow">Join the team</span>
          <h2 className="display" style={{ fontSize: 38 }}><HoverLetters text="Create account" /></h2>
          <p className="text-2">Technicians can sign up here. An admin approves new accounts before first sign-in.</p>
        </div>
        {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
        <div className="field">
          <label className="label" htmlFor="name">Full name</label>
          <div className="input-wrap"><User className="icon-left" /><input id="name" name="name" className="input" placeholder="Arjun Sharma" autoComplete="name" required autoFocus /></div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <div className="input-wrap"><Mail className="icon-left" /><input id="email" name="email" type="email" className="input" placeholder="you@company.com" autoComplete="email" required /></div>
          </div>
          <div className="field">
            <label className="label" htmlFor="phone">Phone</label>
            <div className="input-wrap"><Phone className="icon-left" /><input id="phone" name="phone" type="tel" className="input" placeholder="+91 98765 43210" autoComplete="tel" required /></div>
          </div>
        </div>
        <PasswordInput name="password" label="Password" autoComplete="new-password" showStrength value={pw} onChange={setPw} />
        <PasswordInput name="confirm" label="Confirm password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <span className="spinner" /> : <>Create account <ArrowRight /></>}
        </button>
        <p className="hint" style={{ textAlign: "center" }}>
          Already have an account? <Link href="/login" className="link-underline" style={{ color: "var(--accent)", fontWeight: 700 }}>Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
