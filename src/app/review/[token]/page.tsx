import { notFound } from "next/navigation";
import { loadQueryDetail } from "@/lib/db";
import { ticketCode } from "@/lib/format";
import { PublicNav } from "@/components/public-nav";
import { ReviewForm } from "./review-form";

export const metadata = { title: "Rate your service", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const q = await loadQueryDetail({ reviewToken: token });
  if (!q || q.status !== "COMPLETED") notFound();
  const name = q.submissions[0]?.customerName || q.customerName;

  return (
    <>
      <div className="aurora" />
      <PublicNav />
      <main className="container" style={{ maxWidth: 620, paddingTop: 50, paddingBottom: 60 }}>
        <ReviewForm
          token={token}
          already={!!q.review}
          defaultName={name}
          job={{ code: ticketCode(q.number), title: q.title, device: q.deviceType, techs: q.assignments.map((a) => a.user.name.split(" ")[0]) }}
        />
      </main>
    </>
  );
}
