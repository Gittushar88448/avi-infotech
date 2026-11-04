"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Mail, MapPin, MapPinOff, RotateCw, X } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { HoverLetters } from "@/components/fancy-text";
import { GEO_HELP, getPosition, tryCloseApp, type GeoFailure } from "@/lib/geo";

export function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [blocked, setBlocked] = useState<GeoFailure | null>(params.get("location") === "off" ? "denied" : null);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);

  async function signIn(email: string, password: string, location: unknown = null): Promise<void> {
    setError("");
    setBusy(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, location }),
    });
    const data = await res.json();
    if (res.status === 428 && data.locationRequired) return shareLocationAndRetry(email, password);
    if (!res.ok) {
      setBusy(false);
      return setError(data.error);
    }
    const next = params.get("next");
    window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : data.redirect;
  }

  // Technicians must share their location before they're let in.
  async function shareLocationAndRetry(email: string, password: string): Promise<void> {
    setCreds({ email, password });
    setLocating(true);
    const got = await getPosition();
    setLocating(false);
    if (!got.ok) {
      setBusy(false);
      setBlocked(got.reason);
      if (got.reason === "denied") tryCloseApp();
      return;
    }
    setBlocked(null);
    return signIn(email, password, got.position);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await signIn(String(form.get("email")), String(form.get("password")));
  }

  if (blocked) {
    const help = GEO_HELP[blocked];
    return (
      <div className="stack" style={{ "--gap": "20px" } as React.CSSProperties}>
        <div className="empty-icon" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}><MapPinOff /></div>
        <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
          <span className="eyebrow">Location required</span>
          <h2 className="display" style={{ fontSize: 32 }}>{help.title}</h2>
          <p className="text-2">{help.body}</p>
          <p className="text-2">You can't use the app until location is allowed. Your admin sees your location only while you're signed in.</p>
        </div>
        <button
          className="btn btn-primary btn-lg btn-block"
          disabled={busy}
          onClick={() => (creds ? shareLocationAndRetry(creds.email, creds.password) : setBlocked(null))}
        >
          {busy || locating ? <span className="spinner" /> : <><RotateCw /> I've allowed it, try again</>}
        </button>
        <button className="btn btn-ghost btn-block" onClick={() => { tryCloseApp(); setCreds(null); setBlocked(null); }}>
          <X /> Close
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ "--gap": "20px" } as React.CSSProperties}>
      <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
        <span className="eyebrow">Team sign in</span>
        <h2 className="display" style={{ fontSize: 38 }}>
          <HoverLetters text="Welcome back" />
        </h2>
        <p className="text-2">Sign in to see your jobs and dispatch board.</p>
      </div>
      {params.get("reset") && <div className="alert alert-success">Password updated. Sign in with your new password.</div>}
      {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
      {locating && <div className="alert alert-info"><MapPin /> Allow location access in the browser prompt to finish signing in.</div>}
      <div className="field">
        <label className="label" htmlFor="email">Email</label>
        <div className="input-wrap">
          <Mail className="icon-left" />
          <input id="email" name="email" type="email" className="input" placeholder="you@company.com" autoComplete="email" required autoFocus />
        </div>
      </div>
      <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
        <PasswordInput />
        <Link href="/forgot-password" className="link-underline" style={{ alignSelf: "flex-end", fontSize: 13.5, fontWeight: 700, color: "var(--accent)" }}>
          Forgot password?
        </Link>
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
        {busy ? <span className="spinner" /> : <>Sign in <ArrowRight /></>}
      </button>
      <p className="hint" style={{ textAlign: "center" }}>
        New technician? <Link href="/signup" className="link-underline" style={{ color: "var(--accent)", fontWeight: 700 }}>Create an account</Link>
      </p>
    </form>
  );
}
