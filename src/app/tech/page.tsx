import { Coffee } from "lucide-react";
import { Query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { JobCard } from "@/components/job-card";
import { HoverLetters } from "@/components/fancy-text";

export const dynamic = "force-dynamic";
const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default async function TechHome() {
  const s = (await getSession())!;
  const jobs = await Query.find({ "assignments.user": s.uid, status: { $in: ["ASSIGNED", "IN_PROGRESS", "REWORK", "SUBMITTED"] } })
    .select("-submissions -activities")
    .sort({ createdAt: -1 })
    .lean();

  const active = jobs.filter((j) => j.status !== "SUBMITTED").sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const waiting = jobs.filter((j) => j.status === "SUBMITTED");

  return (
    <div className="page">
      <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
        <span className="eyebrow">Hi {s.name.split(" ")[0]}</span>
        <h1 className="page-title display"><HoverLetters text="Your jobs" /></h1>
        <p className="text-2">{active.length ? `${active.length} job${active.length > 1 ? "s" : ""} need you. New ones show up here instantly.` : "Nothing assigned right now. New jobs will pop up here."}</p>
      </div>
      {active.length === 0 ? (
        <div className="card empty"><div className="empty-icon"><Coffee /></div>All clear. Keep this page open to get new jobs live.</div>
      ) : (
        <div className="grid-3">{active.map((j, i) => <JobCard key={String(j._id)} job={j} i={i} />)}</div>
      )}
      {waiting.length > 0 && (
        <>
          <span className="eyebrow" style={{ marginTop: 10 }}>Waiting for admin review</span>
          <div className="grid-3">{waiting.map((j, i) => <JobCard key={String(j._id)} job={j} i={i} />)}</div>
        </>
      )}
    </div>
  );
}
