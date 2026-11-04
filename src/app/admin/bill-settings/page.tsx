import { getBillSettings } from "@/lib/store/bill-settings";
import { HoverLetters } from "@/components/fancy-text";
import { BillSettingsClient } from "./settings-client";

export const metadata = { title: "Bill settings" };
export const dynamic = "force-dynamic";

export default async function BillSettingsPage() {
  const settings = await getBillSettings();
  return (
    <div className="page" style={{ maxWidth: 920 }}>
      <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
        <span className="eyebrow">Billing</span>
        <h1 className="page-title display"><HoverLetters text="Bill settings" /></h1>
        <p className="text-2">Your company details, GSTIN, bank details and declaration, and what each kind of bill prints.</p>
      </div>
      <div className="card"><BillSettingsClient initial={settings} /></div>
    </div>
  );
}
