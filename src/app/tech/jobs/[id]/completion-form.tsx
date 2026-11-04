"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, ImagePlus, MapPin, Phone, Send, User, X } from "lucide-react";
import { useToast } from "@/components/providers";

type Shot = { id: string; file: File; url: string };

/** Downscales large camera photos in the browser so uploads are fast on mobile data. */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.type === "image/heif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.84));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function CompletionForm({ id, defaults }: { id: string; defaults: { customerName: string; customerPhone: string; customerAddress: string } }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  async function add(list: FileList | null) {
    if (!list) return;
    const files = await Promise.all([...list].filter((f) => f.type.startsWith("image/")).map(compress));
    setShots((s) => [...s, ...files.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))].slice(0, 12));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (shots.length === 0) return setError("Add at least one photo of the finished work.");
    const fd = new FormData(e.currentTarget);
    shots.forEach((s) => fd.append("photos", s.file));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/queries/${id}/submit`);
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 400) {
        setProgress(null);
        return setError(data.error || "Upload failed");
      }
      toast({ kind: "success", title: "Work submitted", body: "Admin has been notified to verify it." });
      router.refresh();
    };
    xhr.onerror = () => { setProgress(null); setError("Network error. Check your connection and try again."); };
    setProgress(0);
    xhr.send(fd);
  }

  return (
    <form onSubmit={onSubmit} className="card stack" style={{ "--gap": "18px" } as React.CSSProperties}>
      <div className="stack" style={{ "--gap": "4px" } as React.CSSProperties}>
        <span className="card-title">Complete this job</span>
        <span className="muted" style={{ fontSize: 13.5 }}>Snap photos of the finished work and confirm the customer's details.</span>
      </div>

      <div
        className="dropzone"
        data-drag={drag}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
      >
        <ImagePlus />
        <strong>Add photos of the completed work</strong>
        <span className="hint">Up to 12 photos. Large photos are resized automatically.</span>
        <div className="row wrap" style={{ justifyContent: "center", marginTop: 6 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => cameraRef.current?.click()}><Camera /> Take photo</button>
          <button type="button" className="btn btn-sm" onClick={() => galleryRef.current?.click()}><ImagePlus /> Choose files</button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>

      {shots.length > 0 && (
        <div className="photos">
          {shots.map((s) => (
            <div key={s.id} className="photo" style={{ animation: "pop-in .35s var(--spring)", cursor: "default" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt="" />
              <button type="button" className="remove" aria-label="Remove photo" onClick={() => setShots((all) => all.filter((x) => x.id !== s.id))}><X /></button>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="customerName">Customer name</label>
          <div className="input-wrap"><User className="icon-left" /><input id="customerName" name="customerName" className="input" defaultValue={defaults.customerName} required /></div>
        </div>
        <div className="field">
          <label className="label" htmlFor="customerPhone">Customer phone</label>
          <div className="input-wrap"><Phone className="icon-left" /><input id="customerPhone" name="customerPhone" type="tel" className="input" defaultValue={defaults.customerPhone} required /></div>
          <span className="hint">The review SMS goes to this number.</span>
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="customerAddress">Address</label>
        <div className="input-wrap"><MapPin className="icon-left" /><input id="customerAddress" name="customerAddress" className="input" defaultValue={defaults.customerAddress} required /></div>
      </div>
      <div className="field">
        <label className="label" htmlFor="notes">Work notes <span className="muted">(optional)</span></label>
        <textarea id="notes" name="notes" className="textarea" placeholder="Replaced PSU on camera 2, re-crimped RJ45, NVR firmware updated to 4.2." />
      </div>

      {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
      {progress !== null && (
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <div style={{ height: 8, borderRadius: 8, background: "var(--surface-3)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, var(--accent), var(--accent-2))", transition: "width .2s" }} />
          </div>
          <span className="hint">{progress < 100 ? `Uploading ${progress}%` : "Saving…"}</span>
        </div>
      )}
      <button className="btn btn-primary btn-lg" disabled={progress !== null}>
        {progress !== null ? <span className="spinner" /> : <><Send /> Submit completed work</>}
      </button>
    </form>
  );
}
