"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Mail, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { HoverLetters } from "@/components/fancy-text";

export default function ForgotPasswordPage() {
  const [state, setState] = useState<{ sent?: boolean; error?: string; busy?: boolean; devLink?: string }>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ busy: true });
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: new FormData(e.currentTarget).get("email") }),
    });
    const data = await res.json();
    setState(res.ok ? { sent: true, devLink: data.devLink } : { error: data.error });
  }

  return (
    <AuthShell>
      <Link href="/login" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", marginLeft: -12 }}>
        <ArrowLeft /> Back to sign in
      </Link>
      {state.sent ? (
        <div className="stack" style={{ "--gap": "14px" } as React.CSSProperties}>
          <div className="empty-icon"><MailCheck /></div>
          <h2 className="display" style={{ fontSize: 34 }}>Check your inbox</h2>
          <p className="text-2">If an account exists for that email, we sent a link to reset the password. The link expires in 30 minutes.</p>
          {state.devLink && (
            <div className="alert alert-info" style={{ flexDirection: "column", gap: 6 }}>
              <strong>Development mode: no email provider is set up</strong>
              <a href={state.devLink} className="link-underline" style={{ wordBreak: "break-all" }}>Open the reset link</a>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="stack" style={{ "--gap": "20px" } as React.CSSProperties}>
          <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
            <span className="eyebrow">Account recovery</span>
            <h2 className="display" style={{ fontSize: 38 }}><HoverLetters text="Forgot password?" /></h2>
            <p className="text-2">Enter your work email and we'll send you a link to choose a new one.</p>
          </div>
          {state.error && <div className="alert alert-error"><AlertCircle />{state.error}</div>}
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <div className="input-wrap">
              <Mail className="icon-left" />
              <input id="email" name="email" type="email" className="input" placeholder="you@company.com" required autoFocus />
            </div>
          </div>
          <button className="btn btn-primary btn-lg btn-block" disabled={state.busy}>
            {state.busy ? <span className="spinner" /> : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
