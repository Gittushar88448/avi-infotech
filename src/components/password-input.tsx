"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export function scorePassword(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}
const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];
const COLORS = ["var(--rose)", "var(--rose)", "var(--violet)", "var(--accent)", "var(--green)"];

export function PasswordInput({
  name = "password",
  label = "Password",
  autoComplete = "current-password",
  showStrength = false,
  value,
  onChange,
}: {
  name?: string;
  label?: string;
  autoComplete?: string;
  showStrength?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [inner, setInner] = useState("");
  const v = value ?? inner;
  const score = scorePassword(v);
  return (
    <div className="field">
      <label className="label" htmlFor={name}>{label}</label>
      <div className="input-wrap">
        <Lock className="icon-left" />
        <input
          id={name}
          name={name}
          className="input"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={showStrength ? 8 : undefined}
          value={v}
          onChange={(e) => (onChange ? onChange(e.target.value) : setInner(e.target.value))}
          placeholder="••••••••"
        />
        <button
          type="button"
          className="reveal"
          onClick={() => setVisible((x) => !x)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff key="off" /> : <Eye key="on" />}
        </button>
      </div>
      {showStrength && v.length > 0 && (
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <div className="strength">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} style={{ background: score >= i ? COLORS[score] : undefined }} />
            ))}
          </div>
          <span className="hint" style={{ color: COLORS[score], fontWeight: 650 }}>{LABELS[score]}</span>
        </div>
      )}
    </div>
  );
}
