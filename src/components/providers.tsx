"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Bell, CheckCircle2, AlertCircle, X } from "lucide-react";

type Toast = { id: number; title: string; body?: string; kind?: "info" | "success" | "error"; href?: string };
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function Providers({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 6000);
  }, []);

  // Cursor-following glow on any `.spotlight` element.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(".spotlight") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertCircle : Bell;
          const content = (
            <>
              <div className="toast-icon"><Icon /></div>
              <div className="stack" style={{ "--gap": "2px" } as React.CSSProperties}>
                <strong style={{ fontSize: 14.5 }}>{t.title}</strong>
                {t.body && <span className="text-2" style={{ fontSize: 13.5 }}>{t.body}</span>}
              </div>
            </>
          );
          return (
            <div key={t.id} className="toast" data-kind={t.kind ?? "info"} role="status">
              {t.href ? <a href={t.href} style={{ display: "contents" }}>{content}</a> : content}
              <button className="icon-btn" style={{ width: 24, height: 24 }} aria-label="Dismiss" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
