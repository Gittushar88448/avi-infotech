import { isTrackingOn, teamLocations } from "@/lib/location";
import { HoverLetters } from "@/components/fancy-text";
import { LiveMap, TrackingSwitch } from "./live-map";

export const metadata = { title: "Live map" };
export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const [enabled, team] = await Promise.all([isTrackingOn(), teamLocations()]);
  return (
    <div className="page" style={{ maxWidth: 1360 }}>
      <div className="page-head">
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <span className="eyebrow">Field team</span>
          <h1 className="page-title display"><HoverLetters text="Live map" /></h1>
          <p className="text-2">Technicians share their location while they're signed in to the app. Click a name to see today's route.</p>
        </div>
        <TrackingSwitch enabled={enabled} />
      </div>
      <LiveMap initialTeam={team} enabled={enabled} />
    </div>
  );
}
