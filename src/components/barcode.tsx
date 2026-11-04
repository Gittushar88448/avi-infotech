"use client";

import { useEffect, useRef } from "react";

/**
 * USB and Bluetooth barcode scanners behave like a keyboard: they type the code very fast and
 * press Enter. This hook catches a scan even when no input has focus, by watching for a burst
 * of keys that arrive a few milliseconds apart and end with Enter. Normal typing is too slow
 * to trigger it. Scans into a focused text field are left to that field.
 */
export function useBarcodeScanner(onScan: (code: string) => void, { minLength = 4, maxGapMs = 40 } = {}) {
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    let buffer = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      if (now - last > maxGapMs) buffer = "";
      last = now;
      if (e.key === "Enter") {
        if (buffer.length >= minLength) {
          e.preventDefault();
          cb.current(buffer);
        }
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [minLength, maxGapMs]);
}

/** Plays a short beep: high for a good scan, low for an unknown code. */
export function beep(ok = true) {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = ok ? 1650 : 320;
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.09 : 0.25));
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.3);
  } catch {}
}
