"use client";

import { useEffect, useRef, useState } from "react";

/** Words slide up one after another on mount. */
export function SplitReveal({ text, className, as: Tag = "span" }: { text: string; className?: string; as?: "span" | "h1" | "h2" }) {
  return (
    <Tag className={`split-reveal ${className ?? ""}`} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="w" aria-hidden>
          <span style={{ "--i": i } as React.CSSProperties}>{w}</span>
          {" "}
        </span>
      ))}
    </Tag>
  );
}

/** Each letter lifts and tints under the cursor. */
export function HoverLetters({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`hover-letters ${className ?? ""}`} aria-label={text}>
      {[...text].map((c, i) => (
        <span key={i} aria-hidden>{c}</span>
      ))}
    </span>
  );
}

/** Cycles through words with a blur-slide transition. */
export function Rotator({ words, interval = 2200, className }: { words: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  return (
    <span className={`rotator ${className ?? ""}`} aria-live="polite">
      <span key={i}>{words[i]}</span>
    </span>
  );
}

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#*";
/** Text that scrambles and resolves on hover (and once on mount). */
export function Scramble({ text, className }: { text: string; className?: string }) {
  const [out, setOut] = useState(text);
  const raf = useRef<number | null>(null);
  const run = () => {
    let frame = 0;
    const total = text.length * 3;
    if (raf.current) cancelAnimationFrame(raf.current);
    const tick = () => {
      frame++;
      setOut(
        [...text].map((c, idx) => (c === " " || idx < frame / 3 ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(""),
      );
      if (frame < total) raf.current = requestAnimationFrame(tick);
    };
    tick();
  };
  useEffect(() => {
    run();
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <span className={`scramble ${className ?? ""}`} onMouseEnter={run} aria-label={text}>
      {out}
    </span>
  );
}

/** Counts up from 0 when scrolled into view. */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / 900);
        setV(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  return <span ref={ref}>{v.toFixed(decimals)}</span>;
}
