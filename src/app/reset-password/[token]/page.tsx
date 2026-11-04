"use client";

import { use, useState } from "react";
import { AlertCircle, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: pw }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      return setError(data.error);
    }
    window.location.href = "/login?reset=1";
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} className="stack" style={{ "--gap": "20px" } as React.CSSProperties}>
        <div className="empty-icon"><KeyRound /></div>
        <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
          <h2 className="display" style={{ fontSize: 36 }}>Choose a new password</h2>
          <p className="text-2">Use at least 8 characters. Mixing cases, numbers and symbols makes it stronger.</p>
        </div>
        {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
        <PasswordInput name="password" label="New password" autoComplete="new-password" showStrength value={pw} onChange={setPw} />
        <PasswordInput name="confirm" label="Confirm password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <span className="spinner" /> : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
