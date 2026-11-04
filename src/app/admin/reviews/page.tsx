import Link from "next/link";
import { Eye, EyeOff, MessageSquareQuote } from "lucide-react";
import { Review } from "@/lib/db";
import { ticketCode, timeAgo } from "@/lib/format";
import { Stars } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { HoverLetters } from "@/components/fancy-text";

export const metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

export default async function AdminReviews() {
  const reviews = await Review.find().sort({ createdAt: -1 }).populate<{ query: { _id: unknown; number: number } | null }>("query", "number").lean();
  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <span className="eyebrow">Customer feedback</span>
          <h1 className="page-title display"><HoverLetters text="Reviews" /></h1>
        </div>
        <Link href="/reviews" target="_blank" className="btn">Public page ↗</Link>
      </div>
      {reviews.length === 0 ? (
        <div className="card empty"><div className="empty-icon"><MessageSquareQuote /></div>Reviews appear here after customers respond to the SMS.</div>
      ) : (
        <div className="grid-2">
          {reviews.map((r, i) => (
            <div key={String(r._id)} className="card spotlight stack" style={{ opacity: r.published ? 1 : 0.6, animation: `rise .45s var(--ease) ${i * 40}ms both` }}>
              <div className="row between">
                <Stars value={r.rating} size={18} />
                <span className="muted" style={{ fontSize: 12.5 }}>{timeAgo(r.createdAt)}</span>
              </div>
              <p className="quote">“{r.comment}”</p>
              <div className="row between wrap">
                <span style={{ fontWeight: 700 }}>{r.customerName} {r.query && <Link href={`/admin/queries/${r.query._id}`} className="mono muted link-underline" style={{ fontSize: 12.5 }}>{ticketCode(r.query.number)}</Link>}</span>
                <ActionButton url={`/api/reviews/${r._id}`} method="PATCH" body={{ published: !r.published }} className="btn btn-sm" success={r.published ? "Hidden from public page" : "Published"}>
                  {r.published ? <><EyeOff /> Hide</> : <><Eye /> Publish</>}
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
