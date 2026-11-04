import Link from "next/link";
import { ArrowUpRight, CalendarClock, MapPin } from "lucide-react";
import { fmtDate, ticketCode, timeAgo } from "@/lib/format";
import { Priority, StatusBadge } from "./ui";

type Job = { _id: unknown; number: number; title: string; status: string; priority: string; siteAddress: string; customerName: string; deviceType: string; scheduledFor?: Date | null; updatedAt: Date };

export function JobCard({ job, i = 0 }: { job: Job; i?: number }) {
  return (
    <Link href={`/tech/jobs/${job._id}`} className="card spotlight card-hover stack" style={{ "--gap": "12px", animation: `rise .45s var(--ease) ${i * 50}ms both`, ...(job.priority === "URGENT" && job.status !== "COMPLETED" ? { borderColor: "var(--rose)" } : {}) } as React.CSSProperties}>
      <div className="row between">
        <span className="mono" style={{ fontWeight: 700, color: "var(--accent)", fontSize: 13 }}>{ticketCode(job.number)}</span>
        <StatusBadge status={job.status} />
      </div>
      <div>
        <div style={{ fontWeight: 750, fontSize: 17, letterSpacing: "-0.01em" }}>{job.title}</div>
        <div className="muted" style={{ fontSize: 13.5 }}>{job.deviceType} · {job.customerName}</div>
      </div>
      <div className="row text-2" style={{ "--gap": "8px", fontSize: 13.5, alignItems: "flex-start" } as React.CSSProperties}>
        <MapPin style={{ width: 16, flex: "none", marginTop: 2 }} /> {job.siteAddress}
      </div>
      <div className="row between">
        <Priority value={job.priority} />
        <span className="row muted" style={{ "--gap": "6px", fontSize: 12.5 } as React.CSSProperties}>
          {job.scheduledFor ? <><CalendarClock style={{ width: 14 }} /> {fmtDate(job.scheduledFor)}</> : timeAgo(job.updatedAt)}
          <ArrowUpRight style={{ width: 16, color: "var(--accent)" }} />
        </span>
      </div>
    </Link>
  );
}
