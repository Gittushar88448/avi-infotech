import { Camera, Star } from "lucide-react";
import { PRIORITY_LABEL, STATUS_LABEL, initials } from "@/lib/format";

export function Logo({ name = process.env.APP_NAME || "Avi Infotech" }: { name?: string }) {
  return (
    <span className="brand" style={{ padding: 0 }}>
      <span className="brand-mark"><Camera /></span>
      <span>{name}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="dot" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Priority({ value }: { value: string }) {
  return (
    <span className={`prio prio-${value}`}>
      <i><b /><b /><b /></i>
      {PRIORITY_LABEL[value] ?? value}
    </span>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ "--size": `${size}px` } as React.CSSProperties} title={name}>
      {initials(name)}
    </span>
  );
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="stars" style={{ "--star": `${size}px` } as React.CSSProperties} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={i <= Math.round(value) ? "" : "off"} fill={i <= Math.round(value) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}
