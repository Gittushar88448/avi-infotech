import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="aurora" />
      <div className="stack" style={{ alignItems: "center", textAlign: "center", "--gap": "14px" } as React.CSSProperties}>
        <div className="empty-icon"><Compass /></div>
        <h1 className="display" style={{ fontSize: 64 }}>404</h1>
        <p className="text-2">This page doesn't exist, or the link has expired.</p>
        <Link href="/" className="btn btn-primary">Go home</Link>
      </div>
    </main>
  );
}
