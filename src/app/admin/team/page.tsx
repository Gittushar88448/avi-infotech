import { Mail, Phone } from "lucide-react";
import { Query, User, openJobCounts } from "@/lib/db";
import type { Types } from "mongoose";
import { getSession } from "@/lib/auth";
import { Avatar } from "@/components/ui";
import { HoverLetters } from "@/components/fancy-text";
import { AddMember, ApprovalActions, MemberActions } from "./team-client";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getSession();
  const [users, open, totals] = await Promise.all([
    User.find().sort({ pendingApproval: -1, role: 1, active: -1, name: 1 }).select("name email phone role active pendingApproval").lean(),
    openJobCounts(),
    // All-time jobs and submissions per technician.
    Query.aggregate<{ _id: Types.ObjectId; jobs: number; submitted: number }>([
      { $project: { users: "$assignments.user", subs: "$submissions.technician" } },
      { $unwind: "$users" },
      { $group: { _id: "$users", jobs: { $sum: 1 }, submitted: { $sum: { $size: { $filter: { input: "$subs", cond: { $eq: ["$$this", "$users"] } } } } } } },
    ]),
  ]);
  const total = Object.fromEntries(totals.map((t) => [String(t._id), t]));

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <span className="eyebrow">People</span>
          <h1 className="page-title display"><HoverLetters text="Your team" /></h1>
        </div>
        <AddMember />
      </div>
      <div className="grid-3">
        {users.map((u, i) => (
          <div key={String(u._id)} className="card spotlight card-hover stack" style={{ opacity: u.active || u.pendingApproval ? 1 : 0.6, ...(u.pendingApproval ? { borderColor: "var(--violet)", boxShadow: "0 0 0 4px var(--violet-soft)" } : {}), animation: `rise .45s var(--ease) ${i * 40}ms both` }}>
            <div className="row">
              <Avatar name={u.name} size={46} />
              <div className="grow">
                <div style={{ fontWeight: 750, fontSize: 16 }}>{u.name}</div>
                <span className={`badge ${u.role === "ADMIN" ? "badge-SUBMITTED" : "badge-ASSIGNED"}`} style={{ height: 22, fontSize: 11.5 }}>
                  {u.role === "ADMIN" ? "Admin" : "Technician"}{u.pendingApproval ? " · Awaiting approval" : !u.active && " · Disabled"}
                </span>
              </div>
            </div>
            <div className="stack text-2" style={{ "--gap": "6px", fontSize: 13.5 } as React.CSSProperties}>
              <span className="row" style={{ "--gap": "8px" } as React.CSSProperties}><Mail style={{ width: 15 }} /> {u.email}</span>
              {u.phone && <span className="row" style={{ "--gap": "8px" } as React.CSSProperties}><Phone style={{ width: 15 }} /> {u.phone}</span>}
            </div>
            {u.role === "TECHNICIAN" && (
              <div className="row" style={{ "--gap": "18px" } as React.CSSProperties}>
                <div><div className="display" style={{ fontSize: 24 }}>{open[String(u._id)] ?? 0}</div><div className="eyebrow" style={{ fontSize: 10 }}>Open</div></div>
                <div><div className="display" style={{ fontSize: 24 }}>{total[String(u._id)]?.submitted ?? 0}</div><div className="eyebrow" style={{ fontSize: 10 }}>Submitted</div></div>
                <div><div className="display" style={{ fontSize: 24 }}>{total[String(u._id)]?.jobs ?? 0}</div><div className="eyebrow" style={{ fontSize: 10 }}>All jobs</div></div>
              </div>
            )}
            {u.pendingApproval ? (
              <ApprovalActions id={String(u._id)} name={u.name} />
            ) : (
              String(u._id) !== session?.uid && <MemberActions id={String(u._id)} name={u.name} active={u.active} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
