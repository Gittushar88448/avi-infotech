import { isId } from "@/lib/db";
import { Customer } from "@/lib/store/models";
import { getBillSettings } from "@/lib/store/bill-settings";
import { SplitReveal } from "@/components/fancy-text";
import { QuoteBuilder } from "../quote-builder";

export const metadata = { title: "New quotation" };
export const dynamic = "force-dynamic";

/** ?customer=<id> starts the quotation for an existing customer. */
export default async function NewQuotationPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  const [{ seller }, c] = await Promise.all([getBillSettings(), isId(customer) ? Customer.findById(customer).lean() : null]);
  const start = c ? { name: c.name, phone: c.phone, email: c.email ?? "", address: c.address ?? "", gstin: c.gstin ?? "", stateName: c.stateName ?? "", stateCode: c.stateCode ?? "" } : null;
  return (
    <div className="page" style={{ maxWidth: 1360 }}>
      <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
        <span className="eyebrow">Quotations</span>
        <h1 className="page-title display"><SplitReveal text="New quotation" /></h1>
        <p className="text-2">Scan or pick products, add custom lines like installation, and the total updates as you go. Prices may be above or below stock; nothing is taken from stock.</p>
      </div>
      <QuoteBuilder defaultTerms={seller.terms} sellerStateCode={seller.stateCode} startCustomer={start} />
    </div>
  );
}
