import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CircleCheckBig, Cpu, MapPin, MessageSquareText, Phone, Send, Trash2, User } from "lucide-react";
import { User as UserModel, isId, loadQueryDetail } from "@/lib/db";
import { fmtDate, ticketCode, timeAgo } from "@/lib/format";
import { Avatar, Priority, Stars, StatusBadge } from "@/components/ui";
import { Scramble } from "@/components/fancy-text";
import { PhotoGrid } from "@/components/photo-grid";
import { ActionButton } from "@/components/action-button";
import { AssignEditor, ReworkButton } from "./admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminQueryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const q = await loadQueryDetail({ _id: id });
  if (!q) notFound();
  const techs = (await UserModel.find({ role: "TECHNICIAN", active: true }).sort({ name: 1 }).select("name").lean()).map((t) => ({ id: String(t._id), name: t.name }));
  const latest = q.submissions[0];

  return (
    <div className="page">
      <Link href="/admin" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", marginLeft: -12 }}><ArrowLeft /> Dispatch board</Link>
      <div className="page-head">
        <div className="stack" style={{ "--gap": "10px" } as React.CSSProperties}>
          <div className="row wrap">
            <Scramble text={ticketCode(q.number)} className="eyebrow" />
            <StatusBadge status={q.status} />
            <Priority value={q.priority} />
          </div>
          <h1 className="page-title display">{q.title}</h1>
          <span className="muted" style={{ fontSize: 13.5 }}>Logged by {q.createdBy.name} · {fmtDate(q.createdAt)}</span>
        </div>
        <div className="row wrap">
          {q.status === "SUBMITTED" && (
            <>
              <ReworkButton id={q.id} />
              <ActionButton url={`/api/queries/${q.id}/complete`} className="btn btn-success" confirm="Mark this job complete and text the customer a review link?" success="Marked complete · review SMS sent">
                <CircleCheckBig /> Verify &amp; complete
              </ActionButton>
            </>
          )}
          {q.status === "COMPLETED" && !q.review && (
            <ActionButton url={`/api/queries/${q.id}/resend-sms`} success="Review SMS sent again"><Send /> Resend review SMS</ActionButton>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 340px)", gap: 18, alignItems: "start" }} className="detail-grid">
        <div className="stack" style={{ "--gap": "18px" } as React.CSSProperties}>
          <section className="card stack">
            <span className="card-title">Job details</span>
            <p style={{ whiteSpace: "pre-wrap" }} className="text-2">{q.description}</p>
            <div className="grid-2">
              <Info icon={<User />} label="Customer" value={q.customerName} />
              <Info icon={<Phone />} label="Phone" value={<a href={`tel:${q.customerPhone}`} className="link-underline">{q.customerPhone}</a>} />
              <Info icon={<MapPin />} label="Site" value={<a href={`https://maps.google.com/?q=${encodeURIComponent(q.siteAddress)}`} target="_blank" className="link-underline">{q.siteAddress}</a>} />
              <Info icon={<Cpu />} label="Device" value={q.deviceType} />
              {q.scheduledFor && <Info icon={<CalendarClock />} label="Visit" value={fmtDate(q.scheduledFor)} />}
            </div>
          </section>

          {latest ? (
            <section className="card stack" style={q.status === "SUBMITTED" ? { borderColor: "var(--violet)", boxShadow: "0 0 0 4px var(--violet-soft)" } : undefined}>
              <div className="row between wrap">
                <span className="card-title">Completion report</span>
                <span className="muted" style={{ fontSize: 13 }}>by {latest.technician.name} · {timeAgo(latest.createdAt)}</span>
              </div>
              <PhotoGrid files={latest.photos.map((p) => p.fileName)} />
              <div className="grid-3">
                <Info icon={<User />} label="Customer name" value={latest.customerName} />
                <Info icon={<Phone />} label="Customer phone" value={latest.customerPhone} />
                <Info icon={<MapPin />} label="Address" value={latest.customerAddress} />
              </div>
              {latest.notes && (
                <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: 14 }}>
                  <span className="eyebrow">Technician notes</span>
                  <p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{latest.notes}</p>
                </div>
              )}
              {q.submissions.length > 1 && <span className="hint">{q.submissions.length - 1} earlier submission{q.submissions.length > 2 ? "s" : ""} were sent back for rework.</span>}
            </section>
          ) : (
            <section className="card empty">
              <div className="empty-icon"><Cpu /></div>
              Waiting for the technician to submit their work.
            </section>
          )}

          {q.review && (
            <section className="card stack">
              <div className="row between">
                <span className="card-title">Customer review</span>
                <Stars value={q.review.rating} size={18} />
              </div>
              <p className="quote">“{q.review.comment}”</p>
              <span className="muted" style={{ fontSize: 13 }}>{q.review.customerName} · {timeAgo(q.review.createdAt)}</span>
            </section>
          )}
        </div>

        <div className="stack" style={{ "--gap": "18px" } as React.CSSProperties}>
          <section className="card stack">
            <div className="row between">
              <span className="card-title">Technicians</span>
              <AssignEditor id={q.id} all={techs} assigned={q.assignments.map((a) => a.userId)} locked={q.status === "COMPLETED"} />
            </div>
            {q.assignments.map((a) => (
              <div key={a.id} className="row">
                <Avatar name={a.user.name} size={36} />
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{a.user.name}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{a.acceptedAt ? `Accepted ${timeAgo(a.acceptedAt)}` : "Not accepted yet"}</div>
                </div>
                {a.user.phone && <a className="icon-btn" href={`tel:${a.user.phone}`} aria-label={`Call ${a.user.name}`}><Phone /></a>}
              </div>
            ))}
          </section>

          {q.status === "COMPLETED" && (
            <section className="card stack" style={{ "--gap": "8px" } as React.CSSProperties}>
              <span className="card-title">Review request</span>
              <div className="row">
                <MessageSquareText style={{ width: 18, color: q.smsStatus === "FAILED" ? "var(--rose)" : "var(--green)" }} />
                <span style={{ fontWeight: 650 }}>{q.review ? "Customer left a review" : q.smsStatus === "FAILED" ? "SMS failed to send" : "SMS sent, awaiting review"}</span>
              </div>
              {q.reviewToken && <Link href={`/review/${q.reviewToken}`} target="_blank" className="link-underline hint" style={{ color: "var(--accent)" }}>Open review link ↗</Link>}
            </section>
          )}

          <section className="card stack">
            <span className="card-title">Activity</span>
            <div className="timeline">
              {q.activities.map((a, i) => (
                <div key={a.id} className="tl-item" style={{ "--i": i } as React.CSSProperties}>
                  <span className="tl-dot" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{a.message}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{fmtDate(a.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <ActionButton url={`/api/queries/${q.id}`} method="DELETE" className="btn btn-ghost btn-sm" confirm="Delete this query permanently? This can't be undone." redirectTo="/admin">
            <Trash2 /> Delete query
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="row" style={{ alignItems: "flex-start", "--gap": "10px" } as React.CSSProperties}>
      <span style={{ width: 34, height: 34, flex: "none", borderRadius: 10, display: "grid", placeItems: "center", background: "var(--surface-3)", color: "var(--accent)" }} className="info-icon">{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow" style={{ fontSize: 10.5 }}>{label}</div>
        <div style={{ fontWeight: 650, overflowWrap: "anywhere" }}>{value}</div>
      </div>
    </div>
  );
}
