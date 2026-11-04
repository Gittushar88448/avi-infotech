import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SplitReveal } from "@/components/fancy-text";
import { ImportProducts } from "./import-client";

export const metadata = { title: "Import products" };

export default function ImportPage() {
  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <Link href="/admin/products" className="row muted" style={{ "--gap": "6px", fontWeight: 700, fontSize: 14 } as React.CSSProperties}><ArrowLeft style={{ width: 16 }} /> All products</Link>
      <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
        <span className="eyebrow">Inventory</span>
        <h1 className="page-title display"><SplitReveal text="Import products from CSV" /></h1>
        <p className="text-2">Bring in your existing product list and stock in one go. You'll see a preview before anything is saved.</p>
      </div>
      <ImportProducts />
    </div>
  );
}
