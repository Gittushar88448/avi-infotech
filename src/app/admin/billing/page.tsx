import { isId } from "@/lib/db";
import { Customer } from "@/lib/store/models";
import { listCategories } from "@/lib/store/products";
import { getBillSettings } from "@/lib/store/bill-settings";
import { SplitReveal } from "@/components/fancy-text";
import { PointOfSale } from "./pos";

export const metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

/** ?customer=<id> starts a new bill for a returning customer (from their customer page). */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer: customerId } = await searchParams;
  const [categories, billSettings, c] = await Promise.all([
    listCategories(),
    getBillSettings(),
    isId(customerId) ? Customer.findById(customerId).lean() : null,
  ]);
  const startCustomer = c
    ? { name: c.name, phone: c.phone, email: c.email ?? "", address: c.address ?? "", gstin: c.gstin ?? "", stateName: c.stateName ?? "", stateCode: c.stateCode ?? "" }
    : null;
  return (
    <div className="page" style={{ maxWidth: 1360 }}>
      <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
        <span className="eyebrow">Counter</span>
        <h1 className="page-title display"><SplitReveal text={startCustomer ? `New bill for ${startCustomer.name}` : "New bill"} /></h1>
        <p className="text-2">Scan products with the barcode scanner, or choose them from the product list. Add as many products as you need.</p>
      </div>
      <PointOfSale key={customerId ?? "new"} categories={categories.map((c) => c.name)} billSettings={billSettings} startCustomer={startCustomer} />
    </div>
  );
}
