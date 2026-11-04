"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, PartyPopper, Star } from "lucide-react";
import { HoverLetters } from "@/components/fancy-text";

const WORDS = ["", "Poor", "Fair", "Good", "Great", "Excellent!"];

export function ReviewForm({ token, already, defaultName, job }: { token: string; already: boolean; defaultName: string; job: { code: string; title: string; device: string; techs: string[] } }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [burst, setBurst] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(already);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError("Tap a star to rate the service.");
    setBusy(true);
    setError("");
    const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, rating, comment, name }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setDone(true);
  }

  if (done) {
    return (
      <div className="card stack" style={{ alignItems: "center", textAlign: "center", padding: 44, "--gap": "14px" } as React.CSSProperties}>
        <div className="empty-icon"><PartyPopper /></div>
        <h1 className="display" style={{ fontSize: 36 }}>Thank you{name ? `, ${name.split(" ")[0]}` : ""}!</h1>
        <p className="text-2">Your feedback helps our team and helps other customers choose with confidence.</p>
        <Link href="/reviews" className="btn btn-primary">See all reviews</Link>
      </div>
    );
  }

  const shown = hover || rating;
  return (
    <form onSubmit={submit} className="card stack" style={{ padding: 30, "--gap": "22px" } as React.CSSProperties}>
      <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
        <span className="eyebrow mono">{job.code} · {job.device}</span>
        <h1 className="display" style={{ fontSize: 36 }}><HoverLetters text="How did we do?" /></h1>
        <p className="text-2">Your request “{job.title}” was completed by {job.techs.join(" & ")}. Rate the service below.</p>
      </div>
      <div className="stack" style={{ alignItems: "center", "--gap": "6px" } as React.CSSProperties}>
        <div className="star-input" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={`${n}-${burst}`}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              data-on={n <= shown}
              data-burst={burst > 0 && n <= rating}
              onMouseEnter={() => setHover(n)}
              onClick={() => { setRating(n); setBurst((b) => b + 1); }}
              style={{ animationDelay: `${n * 40}ms` }}
            >
              <Star />
            </button>
          ))}
        </div>
        <span className="display" style={{ height: 28, fontSize: 20, color: "var(--accent-2)" }}>{WORDS[shown]}</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="comment">Tell us more</label>
        <textarea id="comment" className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} required minLength={3} maxLength={2000} placeholder="Was the technician on time? Is everything working well?" />
        <span className="hint" style={{ textAlign: "right" }}>{comment.length}/2000</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="name">Name shown with your review</label>
        <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </div>
      {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
      <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? <span className="spinner" /> : "Post my review"}</button>
      <p className="hint" style={{ textAlign: "center" }}>Your review will be visible on our public reviews page. Your phone number is never shown.</p>
    </form>
  );
}
