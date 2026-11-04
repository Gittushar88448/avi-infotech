import Link from "next/link";
import { Logo } from "./ui";
import { ThemeToggle } from "./theme-toggle";
import { Rotator, SplitReveal } from "./fancy-text";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <Link href="/" style={{ color: "#fff" }}><Logo /></Link>
        <div className="stack" style={{ "--gap": "18px" } as React.CSSProperties}>
          <span className="eyebrow">Field service, in real time</span>
          <h1 className="display" style={{ fontSize: "clamp(36px, 4vw, 54px)", lineHeight: 1.05 }}>
            <SplitReveal text="Every site visit," />
            <br />
            <em>
              <Rotator words={["dispatched.", "tracked.", "verified.", "reviewed."]} />
            </em>
          </h1>
          <p style={{ maxWidth: 420, color: "rgba(232,243,250,.72)", fontSize: 16 }}>
            Assign camera and hardware jobs to your crew, get proof of work with photos, and turn every finished job into a customer review.
          </p>
        </div>
        <p style={{ fontSize: 13, color: "rgba(232,243,250,.5)" }}>
          <Link href="/reviews" className="link-underline">Read what customers say →</Link>
        </p>
      </aside>
      <main className="auth-form">
        <div style={{ position: "fixed", top: 16, right: 16 }}><ThemeToggle /></div>
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
