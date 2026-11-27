import Link from "next/link";
import { AlertTriangle, Boxes, ChevronRight, FileUp, IndianRupee, Package, PackageX, Search } from "lucide-react";
import { Product } from "@/lib/store/models";
import { listCategories, productDTO, searchProducts } from "@/lib/store/products";
import { formatINR, formatINRShort } from "@/lib/store/money";
import { CountUp, HoverLetters } from "@/components/fancy-text";
import { PurchaseBadge, StockBadge } from "@/components/store-ui";
import { parsePurchaseType } from "@/lib/store/bill-format";
import { AddProduct, ScanToAdd, StockButton } from "./products-client";
import { LiveFilter } from "@/components/live-filter";

export const metadata = { title: "Products & stock" };
export const dynamic = "force-dynamic";

const PURCHASE_FILTERS = [
  { v: "", l: "All bills" },
  { v: "GST", l: "GST" },
  { v: "LOCAL", l: "Without GST" },
] as const;

const STOCK_FILTERS = [
  { v: "all", l: "All" },
  { v: "low", l: "Low stock" },
  { v: "out", l: "Out of stock" },
  { v: "hidden", l: "Hidden" },
] as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; stock?: string; pt?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const stock = STOCK_FILTERS.some((f) => f.v === sp.stock) ? sp.stock! : "all";
  const cat = sp.cat ?? "";
  const parsedPt = parsePurchaseType(sp.pt);
  const pt = parsedPt === "GST" || parsedPt === "LOCAL" ? parsedPt : "";

  const [categories, rows, agg] = await Promise.all([
    listCategories(),
    stock === "hidden"
      ? Product.find({ active: false, deletedAt: { $exists: false }, ...(pt === "LOCAL" ? { purchaseType: "LOCAL" } : pt === "GST" ? { purchaseType: { $ne: "LOCAL" } } : {}) }).sort({ name: 1 }).populate<{ category: { name: string } }>("category", "name").lean()
      : searchProducts(q, { categoryId: cat, purchaseType: pt || undefined, stock: stock === "low" || stock === "out" ? stock : undefined }),
    Product.aggregate<{ products: number; units: number; value: number; cost: number; low: number; out: number }>([
      { $match: { active: true, ...(pt === "LOCAL" ? { purchaseType: "LOCAL" } : pt === "GST" ? { purchaseType: { $ne: "LOCAL" } } : {}) } },
      {
        $group: {
          _id: null,
          products: { $sum: 1 },
          units: { $sum: { $max: ["$stock", 0] } },
          value: { $sum: { $multiply: [{ $max: ["$stock", 0] }, "$price"] } },
          cost: { $sum: { $multiply: [{ $max: ["$stock", 0] }, "$costPrice"] } },
          low: { $sum: { $cond: [{ $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", "$lowStockAt"] }] }, 1, 0] } },
          out: { $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const products = rows.map(productDTO);
  const s = agg[0] ?? { products: 0, units: 0, value: 0, cost: 0, low: 0, out: 0 };
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(cat && { cat }), ...(pt && { pt }), ...(stock !== "all" && { stock }), ...patch });
    for (const [k, v] of [...p]) if (!v || v === "all") p.delete(k);
    return `/admin/products${p.size ? `?${p}` : ""}`;
  };

  const stats = [
    { label: "Products", value: <CountUp value={s.products} />, icon: Package, c: "var(--sky)", sc: "var(--sky-soft)" },
    { label: "Units in stock", value: <CountUp value={s.units} />, icon: Boxes, c: "var(--indigo)", sc: "var(--indigo-soft)" },
    { label: "Stock value", value: formatINRShort(s.value), icon: IndianRupee, c: "var(--green)", sc: "var(--green-soft)", sub: s.cost ? `${formatINRShort(s.cost)} at cost` : undefined },
    { label: "Low / out", value: <>{s.low} <span className="muted">/</span> {s.out}</>, icon: AlertTriangle, c: "var(--rose)", sc: "var(--rose-soft)" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <span className="eyebrow">Inventory</span>
          <h1 className="page-title display"><HoverLetters text="Products & stock" /></h1>
        </div>
        <div className="row wrap">
          <Link href="/admin/products/import" className="btn"><FileUp /> Import CSV</Link>
          <ScanToAdd categories={categories.map((c) => c.name)} />
          <AddProduct categories={categories.map((c) => c.name)} />
        </div>
      </div>

      <div className="stats">
        {stats.map((x, i) => (
          <div key={x.label} className="card stat spotlight card-hover" style={{ animation: `rise .5s var(--ease) ${i * 60}ms both` }}>
            <span className="eyebrow">{x.label}</span>
            <div className="stat-icon" style={{ "--c": x.c, "--s": x.sc } as React.CSSProperties}><x.icon /></div>
            <div className="stat-value" style={{ fontSize: 32 }}>{x.value}</div>
            {x.sub && <span className="hint">{x.sub}</span>}
          </div>
        ))}
      </div>

      <div className="row wrap between">
        <nav className="tabs">
          {STOCK_FILTERS.map((f) => (
            <Link key={f.v} href={href({ stock: f.v })} className="tab" data-active={stock === f.v}>
              {f.l}
              {f.v === "low" && s.low > 0 && <small>{s.low}</small>}
              {f.v === "out" && s.out > 0 && <small>{s.out}</small>}
            </Link>
          ))}
        </nav>
        <nav className="tabs" aria-label="Purchase type">
          {PURCHASE_FILTERS.map((f) => (
            <Link key={f.v} href={href({ pt: f.v })} className="tab" data-active={pt === f.v}>{f.l}</Link>
          ))}
        </nav>
        <LiveFilter className="row wrap" style={{ "--gap": "8px" } as React.CSSProperties}>
          {stock !== "all" && <input type="hidden" name="stock" value={stock} />}
          {pt && <input type="hidden" name="pt" value={pt} />}
          <select name="cat" defaultValue={cat} className="select" style={{ height: 42, width: 190 }} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={String(c._id)} value={String(c._id)}>{c.name}</option>)}
          </select>
          <div className="input-wrap" style={{ width: "min(300px, 100%)" }}>
            <Search className="icon-left" />
            <input name="q" defaultValue={q} className="input" type="search" placeholder="Name, brand, model, barcode" style={{ height: 42 }} />
          </div>
        </LiveFilter>
      </div>

      {products.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon"><PackageX /></div>
          <strong style={{ color: "var(--text)" }}>{q || cat || pt || stock !== "all" ? "Nothing matches that filter" : "No products yet"}</strong>
          <span>Click Add by barcode or Add product, or just scan a box with the barcode scanner on this page.</span>
        </div>
      ) : (
        <div className="list table-wrap">
          <table className="table table-rows">
            <thead>
              <tr>
                <th>Product</th>
                <th className="hide-sm">Code</th>
                <th className="hide-sm">Category</th>
                <th className="hide-sm">Bought with</th>
                <th className="num">MRP</th>
                <th className="num hide-sm">Selling</th>
                <th className="hide-xs">Stock</th>
                <th className="hide-sm" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={{ opacity: p.active ? 1 : 0.6 }}>
                  <td>
                    <Link href={`/admin/products/${p.id}`} className="stack" style={{ "--gap": "2px" } as React.CSSProperties}>
                      <span className="row-title" style={{ whiteSpace: "normal" }}>{p.name}</span>
                      <span className="row-sub">{[p.brand, p.model].filter(Boolean).join(" · ") || " "}</span>
                      <span className="show-xs row wrap" style={{ "--gap": "6px", marginTop: 4 } as React.CSSProperties}><StockBadge stock={p.stock} low={p.lowStockAt} unit={p.unit} /><PurchaseBadge type={p.purchaseType} /></span>
                    </Link>
                  </td>
                  <td className="hide-sm mono" style={{ fontSize: 13 }}>{p.barcode || <span className="muted">{p.sku}</span>}</td>
                  <td className="hide-sm text-2">{p.category}</td>
                  <td className="hide-sm"><PurchaseBadge type={p.purchaseType} /></td>
                  <td className="num">{formatINR(p.mrp)}</td>
                  <td className="num hide-sm">{formatINR(p.price)}</td>
                  <td className="hide-xs"><StockBadge stock={p.stock} low={p.lowStockAt} unit={p.unit} /></td>
                  <td className="hide-sm">
                    <div className="row" style={{ "--gap": "6px", justifyContent: "flex-end" } as React.CSSProperties}>
                      {p.active && <StockButton id={p.id} name={p.name} stock={p.stock} unit={p.unit} purchaseType={p.purchaseType} className="btn btn-sm btn-ghost" />}
                      <Link href={`/admin/products/${p.id}`} className="icon-btn" aria-label="Open"><ChevronRight /></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
