"use client";

import { useEffect, useState } from "react";

export function PhotoGrid({ files }: { files: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <div className="photos">
        {files.map((f, i) => (
          <button key={f} className="photo" onClick={() => setOpen(f)} style={{ padding: 0, animation: `rise .4s var(--ease) ${i * 50}ms both` }} aria-label={`Open photo ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/files/${f}`} alt={`Completion photo ${i + 1}`} loading="lazy" />
          </button>
        ))}
      </div>
      {open && (
        <div className="lightbox" onClick={() => setOpen(null)} role="dialog" aria-label="Photo preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/${open}`} alt="Completion photo" />
        </div>
      )}
    </>
  );
}
