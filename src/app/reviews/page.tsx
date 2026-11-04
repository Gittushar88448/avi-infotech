import { MessageSquareQuote } from "lucide-react";
import { Review } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { PublicFooter, PublicNav } from "@/components/public-nav";
import { Stars } from "@/components/ui";
import { CountUp, SplitReveal } from "@/components/fancy-text";

export const metadata = { title: "Customer reviews" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ stars?: string }> }) {
  const stars = Number((await searchParams).stars) || 0;
  const [all, reviews] = await Promise.all([
    Review.aggregate<{ _id: number; n: number }>([{ $match: { published: true } }, { $group: { _id: "$rating", n: { $sum: 1 } } }]),
    Review.find({ published: true, ...(stars && { rating: stars }) })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate<{ query: { deviceType: string } | null }>("query", "deviceType")
      .lean(),
  ]);
  const total = all.reduce((a, r) => a + r.n, 0);
  const avg = total ? all.reduce((a, r) => a + r._id * r.n, 0) / total : 0;
  const countOf = (n: number) => all.find((r) => r._id === n)?.n ?? 0;

  return (
    <>
      <div className="aurora" />
      <PublicNav />
      <main className="container stack" style={{ "--gap": "28px", paddingTop: 50 } as React.CSSProperties}>
        <div className="stack" style={{ "--gap": "10px" } as React.CSSProperties}>
          <span className="eyebrow">Verified customer reviews</span>
          <h1 className="display" style={{ fontSize: "clamp(38px, 6vw, 64px)" }}>
            <SplitReveal text="Real jobs." /> <em className="gradient-text">Real feedback.</em>
          </h1>
          <p className="text-2" style={{ maxWidth: 560 }}>Every review comes from a customer whose service request was completed and verified by our team.</p>
        </div>

        <div className="card reviews-summary" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 36, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div className="display" style={{ fontSize: 64, lineHeight: 1 }}>{total ? <CountUp value={avg} decimals={1} /> : "–"}</div>
            <Stars value={avg} size={20} />
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{total} review{total === 1 ? "" : "s"}</div>
          </div>
          <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
            {[5, 4, 3, 2, 1].map((n) => (
              <a key={n} href={stars === n ? "/reviews" : `/reviews?stars=${n}`} className="row" style={{ "--gap": "10px", fontSize: 13.5, fontWeight: 700, opacity: stars && stars !== n ? 0.45 : 1, transition: "opacity .2s" } as React.CSSProperties}>
                <span style={{ width: 14 }}>{n}</span>
                <div className="grow" style={{ height: 8, borderRadius: 8, background: "var(--surface-3)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${total ? (countOf(n) / total) * 100 : 0}%`, background: "linear-gradient(90deg, var(--accent), var(--accent-2))", borderRadius: 8, animation: "grow-x .9s var(--ease) both" }} />
                </div>
                <span className="muted" style={{ width: 28, textAlign: "right" }}>{countOf(n)}</span>
              </a>
            ))}
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="card empty"><div className="empty-icon"><MessageSquareQuote /></div>{stars ? "No reviews with that rating yet." : "No reviews yet. Check back soon."}</div>
        ) : (
          <div style={{ columns: "320px", columnGap: 16 }}>
            {reviews.map((r, i) => (
              <article key={String(r._id)} className="card spotlight card-hover stack" style={{ breakInside: "avoid", marginBottom: 16, "--gap": "12px", animation: `rise .5s var(--ease) ${Math.min(i, 10) * 50}ms both` } as React.CSSProperties}>
                <div className="row between">
                  <Stars value={r.rating} />
                  <span className="muted" style={{ fontSize: 12.5 }}>{timeAgo(r.createdAt)}</span>
                </div>
                <p className="quote">“{r.comment}”</p>
                <div className="row between">
                  <strong style={{ fontSize: 14 }}>{r.customerName}</strong>
                  <span className="badge" style={{ height: 22, fontSize: 11.5 }}>{r.query?.deviceType ?? "Service"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
