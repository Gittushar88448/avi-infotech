import Link from "next/link";
import { ArrowRight, BellRing, Camera, ShieldCheck, Star, Users } from "lucide-react";
import { Query, Review } from "@/lib/db";
import { PublicFooter, PublicNav } from "@/components/public-nav";
import { CountUp, HoverLetters, Rotator, SplitReveal } from "@/components/fancy-text";
import { Stars } from "@/components/ui";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: Users, title: "Dispatch to many", body: "Log a customer query once and send it to one technician or a whole crew." },
  { icon: BellRing, title: "Instant alerts", body: "Technicians get a live notification with sound the moment a job is assigned." },
  { icon: Camera, title: "Proof of work", body: "Photos, customer name, phone and address are captured on site from any phone." },
  { icon: ShieldCheck, title: "Verified & reviewed", body: "Admins verify each job, and customers get a text inviting them to rate the service." },
];

export default async function Home() {
  const [aggRows, completed, latest] = await Promise.all([
    Review.aggregate<{ avg: number; n: number }>([{ $match: { published: true } }, { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } }]),
    Query.countDocuments({ status: "COMPLETED" }),
    Review.find({ published: true }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  const agg = { avg: aggRows[0]?.avg ?? 0, count: aggRows[0]?.n ?? 0 };

  return (
    <>
      <div className="aurora" />
      <div className="grid-bg" />
      <PublicNav />
      <main className="container">
        <section className="hero">
          <span className="pill"><b>Live</b> Real-time field service desk</span>
          <h1 className="display">
            <SplitReveal text="Camera & hardware service," />
            <br />
            <em className="gradient-text"><Rotator words={["dispatched in seconds.", "proven with photos.", "rated by customers."]} interval={2600} /></em>
          </h1>
          <p className="text-2" style={{ maxWidth: 600, fontSize: 18 }}>
            One place for your team to receive customer queries, fix them on site, and close the loop with a verified report and a review.
          </p>
          <div className="row wrap" style={{ justifyContent: "center" }}>
            <Link href="/login" className="btn btn-primary btn-lg">Open the desk <ArrowRight /></Link>
            <Link href="/reviews" className="btn btn-lg"><Star /> Read reviews</Link>
          </div>
        </section>

        <section className="row wrap" style={{ justifyContent: "center", "--gap": "48px", padding: "10px 0 50px" } as React.CSSProperties}>
          <div style={{ textAlign: "center" }}>
            <div className="display" style={{ fontSize: 48 }}><CountUp value={completed} /></div>
            <div className="eyebrow">Jobs completed</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="display" style={{ fontSize: 48 }}>{agg.count ? <CountUp value={agg.avg} decimals={1} /> : "–"}</div>
            <div className="eyebrow">Average rating</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="display" style={{ fontSize: 48 }}><CountUp value={agg.count} /></div>
            <div className="eyebrow">Customer reviews</div>
          </div>
        </section>

        <section className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className="card spotlight card-hover" style={{ animation: `rise .6s var(--ease) ${300 + i * 90}ms both` }}>
              <div className="feature-icon"><f.icon /></div>
              <h3 style={{ fontSize: 18, fontWeight: 750, marginBottom: 6 }}><HoverLetters text={f.title} /></h3>
              <p className="text-2">{f.body}</p>
            </div>
          ))}
        </section>

        {latest.length > 0 && (
          <section className="stack" style={{ marginTop: 70, "--gap": "22px" } as React.CSSProperties}>
            <div className="row between wrap">
              <h2 className="display" style={{ fontSize: 34 }}>What customers <em>say</em></h2>
              <Link href="/reviews" className="link-underline" style={{ color: "var(--accent)", fontWeight: 700 }}>All reviews →</Link>
            </div>
            <div className="marquee">
              <div className="marquee-track">
                {[...latest, ...latest].map((r, i) => (
                  <div key={`${r._id}-${i}`} className="card review-card stack" style={{ "--gap": "12px" } as React.CSSProperties}>
                    <Stars value={r.rating} />
                    <p className="quote" style={{ display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>“{r.comment}”</p>
                    <strong style={{ fontSize: 14 }}>{r.customerName}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
