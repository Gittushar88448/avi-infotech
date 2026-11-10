import { isId } from "@/lib/db";
import { Customer, Product, Quotation } from "@/lib/store/models";
import { productDTO } from "@/lib/store/products";
import { quoteCode } from "@/lib/store/money";
import { listCategories } from "@/lib/store/products";
import { getBillSettings } from "@/lib/store/bill-settings";
import { SplitReveal } from "@/components/fancy-text";
import { PointOfSale } from "./pos";

export const metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

/** ?customer=<id> starts a new bill for a returning customer (from their customer page). */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ customer?: string; quote?: string }> }) {
  const { customer: customerId, quote: quoteId } = await searchParams;
  const [categories, billSettings, c] = await Promise.all([
    listCategories(),
    getBillSettings(),
    isId(customerId) ? Customer.findById(customerId).lean() : null,
  ]);
  let startCustomer = c
    ? { name: c.name, phone: c.phone, email: c.email ?? "", address: c.address ?? "", gstin: c.gstin ?? "", stateName: c.stateName ?? "", stateCode: c.stateCode ?? "" }
    : null;

  // ?quote=<id>: start the bill from a quotation (its catalog products, quantities and prices).
  const quote = isId(quoteId) ? await Quotation.findById(quoteId).lean() : null;
  let fromQuote: { id: string; code: string; skipped: string[]; lines: { product: ReturnType<typeof productDTO>; qty: number; unitPrice: number; discount: number }[] } | null = null;
  if (quote && quote.status !== "CONVERTED") {
    const ids = quote.items.filter((i) => i.product).map((i) => String(i.product));
    const products = await Product.find({ _id: { $in: ids }, active: true }).populate<{ category: { name: string } }>("category", "name").lean();
    const byId = new Map(products.map((p) => [String(p._id), productDTO(p)]));
    fromQuote = {
      id: String(quote._id),
      code: quoteCode(quote.number),
      skipped: quote.items.filter((i) => !i.product || !byId.has(String(i.product))).map((i) => i.name),
      // Bills can't go above MRP, so a quoted price above MRP is capped.
      lines: quote.items.filter((i) => i.product && byId.has(String(i.product))).map((i) => {
        const p = byId.get(String(i.product))!;
        return { product: p, qty: i.qty, unitPrice: Math.min(i.unitPrice, p.mrp), discount: i.discount };
      }),
    };
    const cs = quote.customerSnapshot;
    if (!startCustomer && cs?.name) startCustomer = { name: cs.name, phone: cs.phone ?? "", email: cs.email ?? "", address: cs.address ?? "", gstin: cs.gstin ?? "", stateName: cs.stateName ?? "", stateCode: cs.stateCode ?? "" };
  }
  return (
    <div className="page" style={{ maxWidth: 1360 }}>
      <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
        <span className="eyebrow">Counter</span>
        <h1 className="page-title display"><SplitReveal text={fromQuote ? `Bill from ${fromQuote.code}` : startCustomer ? `New bill for ${startCustomer.name}` : "New bill"} /></h1>
        <p className="text-2">Scan products with the barcode scanner, or choose them from the product list. Add as many products as you need.</p>
      </div>
      <PointOfSale key={quoteId ?? customerId ?? "new"} categories={categories.map((c) => c.name)} billSettings={billSettings} startCustomer={startCustomer} fromQuote={fromQuote} />
    </div>
  );
}
