import { requireRole } from "@/lib/auth";
import { Query } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { LocationGate } from "@/components/location-gate";
import { isTrackingOn } from "@/lib/location";

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("TECHNICIAN");
  const [open, tracking] = await Promise.all([
    Query.countDocuments({ "assignments.user": session.uid, status: { $in: ["ASSIGNED", "IN_PROGRESS", "REWORK"] } }),
    isTrackingOn(),
  ]);
  return (
    <AppShell
      session={session}
      topbar={<LocationGate enabled={tracking} />}
      nav={[
        { href: "/tech", label: "My jobs", icon: "jobs", exact: true, count: open },
        { href: "/tech/history", label: "History", icon: "history" },
        { href: "/reviews", label: "Reviews", icon: "reviews" },
      ]}
    >
      {children}
    </AppShell>
  );
}
