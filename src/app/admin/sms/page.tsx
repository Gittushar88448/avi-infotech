import { Send } from "lucide-react";
import { SmsLog } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { HoverLetters } from "@/components/fancy-text";

export const metadata = { title: "SMS log" };
export const dynamic = "force-dynamic";

export default async function SmsLogPage() {
  const logs = await SmsLog.find().sort({ createdAt: -1 }).limit(200).lean();
  const provider = process.env.SMS_PROVIDER || "console";
  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <span className="eyebrow">Outbound messages</span>
          <h1 className="page-title display"><HoverLetters text="SMS log" /></h1>
        </div>
        <span className="badge badge-ASSIGNED">Provider: {provider}</span>
      </div>
      {provider === "console" && (
        <div className="alert alert-info">Test mode: messages are recorded here but not delivered. Set SMS_PROVIDER=twilio and your Twilio keys to send real texts.</div>
      )}
      {logs.length === 0 ? (
        <div className="card empty"><div className="empty-icon"><Send /></div>No messages sent yet.</div>
      ) : (
        <div className="list">
          {logs.map((l, i) => (
            <div key={String(l._id)} className="list-row" style={{ gridTemplateColumns: "160px minmax(0,1fr) 110px", "--i": Math.min(i, 12) } as React.CSSProperties}>
              <div className="stack" style={{ "--gap": "2px" } as React.CSSProperties}>
                <span className="mono" style={{ fontWeight: 700 }}>{l.to}</span>
                <span className="muted" style={{ fontSize: 12 }}>{fmtDate(l.createdAt)}</span>
              </div>
              <div className="stack" style={{ "--gap": "2px", minWidth: 0 } as React.CSSProperties}>
                <span style={{ fontSize: 14 }}>{l.body}</span>
                {l.error && <span className="error-text">{l.error}</span>}
              </div>
              <span className={`badge ${l.status === "SENT" ? "badge-COMPLETED" : "badge-REWORK"}`} style={{ justifySelf: "end" }}>{l.status === "SENT" ? "Sent" : "Failed"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
