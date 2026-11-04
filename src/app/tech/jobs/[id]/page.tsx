import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Cpu, MapPin, Navigation, Phone, RotateCcw, User } from "lucide-react";
import { isId, loadQueryDetail } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fmtDate, ticketCode, timeAgo } from "@/lib/format";
import { Avatar, Priority, StatusBadge } from "@/components/ui";
import { Scramble } from "@/components/fancy-text";
import { ActionButton } from "@/components/action-button";
import { PhotoGrid } from "@/components/photo-grid";
import { CompletionForm } from "./completion-form";

export const dynamic = "force-dynamic";

export default async function TechJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const s = (await getSession())!;
  const q = await loadQueryDetail({ _id: id, "assignments.user": s.uid });
  if (!q) notFound();
  const mine = q.assignments.find((a) => a.userId === s.uid)!;
  const crew = q.assignments.filter((a) => a.userId !== s.uid);
  const latest = q.submissions[0];
  const rework = q.activities.find((a) => a.message.startsWith("Sent back"));
  const canWork = ["ASSIGNED", "IN_PROGRESS", "REWORK"].includes(q.status);

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <Link href="/tech" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", marginLeft: -12 }}><ArrowLeft /> My jobs</Link>
      <div className="stack" style={{ "--gap": "10px" } as React.CSSProperties}>
        <div className="row wrap">
          <Scramble text={ticketCode(q.number)} className="eyebrow" />
          <StatusBadge status={q.status} />
          <Priority value={q.priority} />
        </div>
        <h1 className="page-title display">{q.title}</h1>
      </div>

      {q.status === "REWORK" && rework && (
        <div className="alert alert-error"><RotateCcw /><div><strong>Sent back by admin</strong><div>{rework.message.replace(/^Sent back for rework: /, "")}</div></div></div>
      )}

      <section className="card stack">
        <p className="text-2" style={{ whiteSpace: "pre-wrap" }}>{q.description}</p>
        <hr className="divider" />
        <div className="stack" style={{ "--gap": "12px" } as React.CSSProperties}>
          <Line icon={<User />}>{q.customerName}</Line>
          <Line icon={<MapPin />}>{q.siteAddress}</Line>
          <Line icon={<Cpu />}>{q.deviceType}</Line>
          {q.scheduledFor && <Line icon={<CalendarClock />}>{fmtDate(q.scheduledFor)}</Line>}
        </div>
        <div className="row wrap">
          <a className="btn" href={`tel:${q.customerPhone}`}><Phone /> Call customer</a>
          <a className="btn" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q.siteAddress)}`} target="_blank" rel="noreferrer"><Navigation /> Directions</a>
          {canWork && !mine.acceptedAt && (
            <ActionButton url={`/api/queries/${q.id}/start`} className="btn btn-primary" success="Job accepted. Admin has been notified.">Accept &amp; start job</ActionButton>
          )}
        </div>
        {crew.length > 0 && (
          <div className="row wrap" style={{ "--gap": "8px" } as React.CSSProperties}>
            <span className="muted" style={{ fontSize: 13, fontWeight: 650 }}>Also on this job:</span>
            {crew.map((a) => (
              <span key={a.id} className="chip" style={{ cursor: "default" }}>
                <Avatar name={a.user.name} size={24} /> {a.user.name}
              </span>
            ))}
          </div>
        )}
      </section>

      {canWork ? (
        mine.acceptedAt || q.status !== "ASSIGNED" ? (
          <CompletionForm id={q.id} defaults={{ customerName: q.customerName, customerPhone: q.customerPhone, customerAddress: q.siteAddress }} />
        ) : (
          <div className="alert alert-info">Accept the job when you're on your way. You can submit photos and customer details once you've started.</div>
        )
      ) : latest ? (
        <section className="card stack">
          <div className="row between wrap">
            <span className="card-title">{q.status === "COMPLETED" ? "Approved report" : "Submitted report"}</span>
            <span className="muted" style={{ fontSize: 13 }}>by {latest.technician.name} · {timeAgo(latest.createdAt)}</span>
          </div>
          <PhotoGrid files={latest.photos.map((p) => p.fileName)} />
          <div className="text-2" style={{ fontSize: 14 }}>{latest.customerName} · {latest.customerPhone} · {latest.customerAddress}</div>
          {latest.notes && <p style={{ whiteSpace: "pre-wrap" }}>{latest.notes}</p>}
        </section>
      ) : null}
    </div>
  );
}

function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="row" style={{ "--gap": "10px", fontWeight: 600 } as React.CSSProperties}>
      <span className="info-icon" style={{ width: 30, height: 30, flex: "none", borderRadius: 9, display: "grid", placeItems: "center", background: "var(--surface-3)", color: "var(--accent)" }}>{icon}</span>
      {children}
    </div>
  );
}
