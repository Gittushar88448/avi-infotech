import Link from "next/link";
import { ChevronRight, CircleCheckBig, ClipboardList, Hourglass, Inbox, Plus, Search, Star, Wrench } from "lucide-react";
import { Query, Review } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { STATUS_LABEL, ticketCode, timeAgo } from "@/lib/format";
import { Avatar, Priority, StatusBadge } from "@/components/ui";
import { CountUp, HoverLetters } from "@/components/fancy-text";
import { LiveFilter } from "@/components/live-filter";

export const dynamic = "force-dynamic";
const FILTERS = ["ALL", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "REWORK", "COMPLETED"] as const;

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const status = FILTERS.includes(sp.status as (typeof FILTERS)[number]) ? sp.status! : "ALL";
  const q = sp.q?.trim() ?? "";
  const session = await getSession();

  const num = Number(q.replace(/^q-?/i, ""));
  const rx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
  const [counts, ratingAgg, queries] = await Promise.all([
    Query.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Review.aggregate<{ avg: number; n: number }>([{ $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } }]),
    Query.find({
      ...(status !== "ALL" && { status }),
      ...(rx && { $or: [{ title: rx }, { customerName: rx }, { siteAddress: rx }, { customerPhone: rx }, ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : [])] }),
    })
      .select("number title customerName siteAddress priority status updatedAt assignments")
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate<{ assignments: { _id: unknown; user: { name: string } }[] }>("assignments.user", "name")
      .lean(),
  ]);
  const rating = { avg: ratingAgg[0]?.avg ?? 0, count: ratingAgg[0]?.n ?? 0 };
  const count = (s: string) => counts.find((c) => c._id === s)?.n ?? 0;
  const total = counts.reduce((a, c) => a + c.n, 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const stats = [
    { label: "Open jobs", value: count("ASSIGNED") + count("REWORK"), icon: ClipboardList, c: "var(--sky)", s: "var(--sky-soft)" },
    { label: "In progress", value: count("IN_PROGRESS"), icon: Wrench, c: "var(--indigo)", s: "var(--indigo-soft)" },
    { label: "Awaiting review", value: count("SUBMITTED"), icon: Hourglass, c: "var(--violet)", s: "var(--violet-soft)" },
    { label: "Completed", value: count("COMPLETED"), icon: CircleCheckBig, c: "var(--green)", s: "var(--green-soft)" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <span className="eyebrow">{greet}, {session?.name.split(" ")[0]}</span>
          <h1 className="page-title display"><HoverLetters text="Dispatch board" /></h1>
        </div>
        <Link href="/admin/queries/new" className="btn btn-primary"><Plus /> New query</Link>
      </div>

      <div className="stats">
        {stats.map((s, i) => (
          <div key={s.label} className="card stat spotlight card-hover" style={{ animation: `rise .5s var(--ease) ${i * 60}ms both` }}>
            <span className="eyebrow">{s.label}</span>
            <div className="stat-icon" style={{ "--c": s.c, "--s": s.s } as React.CSSProperties}><s.icon /></div>
            <div className="stat-value"><CountUp value={s.value} /></div>
          </div>
        ))}
      </div>

      <div className="card row wrap between" style={{ padding: "14px 18px" }}>
        <div className="row" style={{ "--gap": "10px" } as React.CSSProperties}>
          <Star style={{ color: "var(--accent-2)", width: 20 }} fill="currentColor" />
          <span style={{ fontWeight: 700 }}>
            {rating.count ? <>Average rating <span className="display" style={{ fontSize: 20 }}>{rating.avg.toFixed(1)}</span> from {rating.count} review{rating.count > 1 ? "s" : ""}</> : "No customer reviews yet"}
          </span>
        </div>
        <Link href="/reviews" target="_blank" className="link-underline" style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>View public page ↗</Link>
      </div>

      <div className="row wrap between">
        <nav className="tabs">
          {FILTERS.map((f) => (
            <Link key={f} href={`/admin?status=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="tab" data-active={status === f}>
              {f === "ALL" ? "All" : STATUS_LABEL[f]} <small>{f === "ALL" ? total : count(f)}</small>
            </Link>
          ))}
        </nav>
        <LiveFilter className="input-wrap" style={{ width: "min(320px, 100%)" }}>
          <input type="hidden" name="status" value={status} />
          <Search className="icon-left" />
          <input name="q" defaultValue={q} className="input" type="search" placeholder="Search customer, address, Q-1001" style={{ height: 42 }} />
        </LiveFilter>
      </div>

      {queries.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon"><Inbox /></div>
          <strong style={{ color: "var(--text)" }}>{q || status !== "ALL" ? "Nothing matches that filter" : "No queries yet"}</strong>
          <span>Create a query to dispatch your first job.</span>
        </div>
      ) : (
        <div className="list">
          {queries.map((x, i) => (
            <Link key={String(x._id)} href={`/admin/queries/${x._id}`} className="list-row" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <span className="mono hide-sm" style={{ fontWeight: 700, color: "var(--accent)" }}>{ticketCode(x.number)}</span>
              <div className="stack" style={{ "--gap": "2px", minWidth: 0 } as React.CSSProperties}>
                <span className="row-title">{x.title}</span>
                <span className="row-sub">{x.customerName} · {x.siteAddress}</span>
              </div>
              <span className="avatar-stack hide-sm">
                {x.assignments.slice(0, 4).map((a) => <Avatar key={String(a._id)} name={a.user?.name ?? "?"} size={30} />)}
                {x.assignments.length > 4 && <span className="avatar" style={{ "--size": "30px" } as React.CSSProperties}>+{x.assignments.length - 4}</span>}
              </span>
              <span className="hide-sm"><Priority value={x.priority} /></span>
              <div className="stack" style={{ "--gap": "4px", alignItems: "flex-end" } as React.CSSProperties}>
                <StatusBadge status={x.status} />
                <span className="muted" style={{ fontSize: 12 }}>{timeAgo(x.updatedAt)}</span>
              </div>
              <ChevronRight className="go hide-sm" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
