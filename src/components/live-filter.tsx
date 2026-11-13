"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A GET filter form that applies itself: typing in a search box filters after a short pause,
 * and picking a dropdown, date or checkbox filters straight away. No Search/Apply button needed.
 * Pressing Enter applies at once. Empty fields are left out of the URL.
 */
export function LiveFilter({
  children,
  className,
  style,
  delay = 350,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = () => {
    if (timer.current) clearTimeout(timer.current);
    const el = form.current;
    if (!el) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(el)) {
      const s = String(v).trim();
      if (s) params.set(k, s);
    }
    const qs = params.toString();
    if (qs === last.current) return;
    last.current = qs;
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // When the URL changes some other way (a tab, the back button, a link), show its values in the boxes.
  useEffect(() => {
    if (search === last.current) return;
    last.current = search;
    const sp = new URLSearchParams(search);
    form.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[name]:not([type=hidden]), select[name]").forEach((f) => {
      if (f === document.activeElement) return;
      f.value = sp.get(f.name) ?? "";
    });
  }, [search]);

  const isTyping = (t: EventTarget) => {
    const el = t as HTMLInputElement;
    return el.tagName === "INPUT" && ["text", "search", "tel", "email", "number", ""].includes(el.type);
  };

  return (
    <form
      ref={form}
      role="search"
      className={className}
      style={style}
      data-pending={pending || undefined}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onInput={(e) => {
        if (!isTyping(e.target)) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(apply, delay);
      }}
      onChange={(e) => {
        if (!isTyping(e.target)) apply();
      }}
      onClick={(e) => {
        // A button marked data-clear empties every visible field and shows everything again.
        if (!(e.target as HTMLElement).closest("[data-clear]")) return;
        e.preventDefault();
        form.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input:not([type=hidden]), select").forEach((f) => { f.value = ""; });
        apply();
      }}
    >
      {children}
    </form>
  );
}
