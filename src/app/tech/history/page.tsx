import { History } from "lucide-react";
import { Query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { JobCard } from "@/components/job-card";
import { HoverLetters } from "@/components/fancy-text";

export const metadata = { title: "History" };
export const dynamic = "force-dynamic";

export default async function TechHistory() {
  const s = (await getSession())!;
  const jobs = await Query.find({ "assignments.user": s.uid, status: "COMPLETED" }).select("-submissions -activities").sort({ completedAt: -1 }).limit(60).lean();
  return (
    <div className="page">
      <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
        <span className="eyebrow">Completed</span>
        <h1 className="page-title display"><HoverLetters text="Job history" /></h1>
      </div>
      {jobs.length === 0 ? (
        <div className="card empty"><div className="empty-icon"><History /></div>Completed jobs will show up here.</div>
      ) : (
        <div className="grid-3">{jobs.map((j, i) => <JobCard key={String(j._id)} job={j} i={i} />)}</div>
      )}
    </div>
  );
}
