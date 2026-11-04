import { User, openJobCounts } from "@/lib/db";
import { QueryForm } from "./query-form";
import { SplitReveal } from "@/components/fancy-text";

export const metadata = { title: "New query" };

export default async function NewQueryPage() {
  const [technicians, load] = await Promise.all([
    User.find({ role: "TECHNICIAN", active: true }).sort({ name: 1 }).select("name phone").lean(),
    openJobCounts(),
  ]);
  return (
    <div className="page" style={{ maxWidth: 920 }}>
      <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
        <span className="eyebrow">Dispatch</span>
        <h1 className="page-title display"><SplitReveal text="Log a customer query" /></h1>
        <p className="text-2">Fill in the job, pick who should go, and they'll be notified instantly.</p>
      </div>
      <QueryForm technicians={technicians.map((t) => ({ id: String(t._id), name: t.name, phone: t.phone ?? null, open: load[String(t._id)] ?? 0 }))} />
    </div>
  );
}
