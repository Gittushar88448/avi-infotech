"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { parseCsv, toCsv } from "@/lib/csv";

type Field = "name" | "categoryName" | "mrp" | "price" | "costPrice" | "barcode" | "sku" | "brand" | "model" | "hsn" | "gstRate" | "unit" | "stock" | "lowStockAt" | "warrantyMonths" | "description";

// Column headings we recognise, in any case and with or without spaces/punctuation.
const ALIASES: Record<Field, string[]> = {
  name: ["name", "product", "product name", "item", "item name"],
  categoryName: ["category", "group", "product category"],
  mrp: ["mrp", "max retail price"],
  price: ["selling price", "sale price", "price", "rate", "selling"],
  costPrice: ["cost price", "cost", "purchase price", "buying price"],
  barcode: ["barcode", "bar code", "ean", "upc", "code"],
  sku: ["sku"],
  brand: ["brand", "make"],
  model: ["model", "model no", "model number"],
  hsn: ["hsn", "hsn code", "hsn sac"],
  gstRate: ["gst", "gst %", "gst rate", "tax", "tax %"],
  unit: ["unit", "uom"],
  stock: ["stock", "qty", "quantity", "opening stock", "current stock", "in stock"],
  lowStockAt: ["low stock", "low stock alert", "reorder level", "min stock"],
  warrantyMonths: ["warranty", "warranty months", "warranty (months)"],
  description: ["description", "notes", "details"],
};
const LABEL: Record<Field, string> = {
  name: "Name", categoryName: "Category", mrp: "MRP", price: "Selling price", costPrice: "Cost price", barcode: "Barcode", sku: "SKU",
  brand: "Brand", model: "Model", hsn: "HSN", gstRate: "GST %", unit: "Unit", stock: "Stock", lowStockAt: "Low stock alert", warrantyMonths: "Warranty", description: "Description",
};
const NUMERIC: Field[] = ["mrp", "price", "costPrice", "gstRate", "stock", "lowStockAt", "warrantyMonths"];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%]/g, "");
const LOOKUP = new Map(Object.entries(ALIASES).flatMap(([f, names]) => names.map((n) => [norm(n), f as Field])));

const TEMPLATE = [
  ["name", "category", "brand", "model", "barcode", "mrp", "selling price", "cost price", "gst", "hsn", "unit", "stock", "low stock alert", "warranty months", "description"],
  ["2MP HD Dome Camera", "CCTV camera", "Hikvision", "DS-2CE76D0T-ITPF", "6941264012345", 1850, 1600, 1280, 18, "85258900", "pcs", 24, 3, 24, ""],
  ["BNC Connector (pack of 10)", "Cables & accessories", "", "", "", 150, 120, 90, 18, "85366990", "pcs", 40, 10, 0, "No barcode: gets an AVI SKU"],
];

type Row = { line: number; data: Record<string, string>; problems: string[] };
type Result = { line: number; status: "created" | "updated" | "error"; name: string; message?: string };

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

/** Cleans one cell: "₹1,850.00" → "1850.00", "18%" → "18". */
function clean(field: Field, raw: string) {
  const v = raw.trim();
  return NUMERIC.includes(field) ? v.replace(/[₹,%\s]|rs\.?/gi, "") : v;
}

function check(d: Record<string, string>) {
  const p: string[] = [];
  if (!d.name) p.push("Name is missing");
  if (!d.categoryName) p.push("Category is missing");
  if (!d.mrp) p.push("MRP is missing");
  for (const f of NUMERIC) if (d[f] && Number.isNaN(Number(d[f]))) p.push(`${LABEL[f]} "${d[f]}" isn't a number`);
  if (d.barcode && /^\d+(\.\d+)?e\+?\d+$/i.test(d.barcode)) p.push("Excel changed this barcode to 6.9E+12 form. Format the barcode column as Text in Excel and export again.");
  if (d.mrp && d.price && Number(d.price) > Number(d.mrp)) p.push("Selling price is more than MRP");
  return p;
}

export function ImportProducts() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [mapped, setMapped] = useState<Field[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [stockMode, setStockMode] = useState<"set" | "add">("set");
  const [progress, setProgress] = useState<number | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  async function onFile(file: File | undefined) {
    setError("");
    setResults(null);
    setRows([]);
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) return setError("Choose a .csv file. In Excel use File → Save As → CSV UTF-8.");
    setFileName(file.name);
    const table = parseCsv(await file.text());
    if (table.length < 2) return setError("The file has no product rows under the header.");
    const header = table[0]!;
    const fields = header.map((h) => LOOKUP.get(norm(h)) ?? null);
    if (!fields.includes("name") || !fields.includes("mrp")) return setError('The first row must be column headings, including at least "name", "category" and "mrp". Download the template to see the format.');
    setMapped([...new Set(fields.filter((f): f is Field => !!f))]);
    setIgnored(header.filter((_, i) => !fields[i]).filter(Boolean));
    setRows(
      table.slice(1).map((cells, i) => {
        const data: Record<string, string> = {};
        fields.forEach((f, c) => {
          if (f && cells[c] !== undefined && data[f] === undefined) data[f] = clean(f, cells[c]!);
        });
        return { line: i + 2, data, problems: check(data) };
      }),
    );
  }

  const good = rows.filter((r) => r.problems.length === 0);
  const bad = rows.length - good.length;

  async function runImport() {
    setError("");
    setProgress(0);
    const all: Result[] = [];
    for (let i = 0; i < good.length; i += 200) {
      const chunk = good.slice(i, i + 200).map(({ line, data }) => ({ line, data }));
      const res = await fetch("/api/products/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stockMode, rows: chunk }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "The import stopped part way. Rows already imported are saved; fix the file and import again.");
        break;
      }
      all.push(...data.results);
      setProgress(Math.min(good.length, i + chunk.length));
    }
    setResults(all);
    setProgress(null);
  }

  if (results) {
    const created = results.filter((r) => r.status === "created").length;
    const updated = results.filter((r) => r.status === "updated").length;
    const failed = results.filter((r) => r.status === "error");
    return (
      <section className="card stack">
        <div className="alert alert-success"><CheckCircle2 /> Import finished: {created} new product{created === 1 ? "" : "s"}, {updated} updated{failed.length ? `, ${failed.length} failed` : ""}.</div>
        {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
        {(failed.length > 0 || bad > 0) && (
          <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
            <span className="card-title">Rows not imported</span>
            <ul className="text-2" style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
              {rows.filter((r) => r.problems.length).map((r) => <li key={r.line}>Line {r.line} {r.data.name && `(${r.data.name})`}: {r.problems.join("; ")}</li>)}
              {failed.map((r) => <li key={r.line}>Line {r.line} {r.name && `(${r.name})`}: {r.message}</li>)}
            </ul>
          </div>
        )}
        <div className="row wrap">
          <Link href="/admin/products" className="btn btn-primary">View products</Link>
          <button className="btn" onClick={() => { setResults(null); setRows([]); setFileName(""); }}>Import another file</button>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row wrap between">
          <span className="card-title">1. Prepare your file</span>
          <button className="btn btn-sm" onClick={() => download("products-template.csv", toCsv(TEMPLATE))}><Download /> Download template</button>
        </div>
        <p className="text-2" style={{ fontSize: 14 }}>
          One product per row. Required columns: <b>name</b>, <b>category</b> and <b>mrp</b>. Optional: barcode, sku, brand, model, selling price, cost price, gst, hsn, unit, stock, low stock alert, warranty months, description.
          Prices are in rupees and include GST. Leave barcode empty for items without one.
        </p>
        <p className="hint">From Excel: format the barcode column as <b>Text</b> before typing or pasting barcodes, then use File → Save As → CSV UTF-8.</p>
      </section>

      <section className="card stack">
        <span className="card-title">2. Choose the CSV file</span>
        <label className="dropzone" style={{ cursor: "pointer" }}>
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <FileSpreadsheet style={{ width: 28, height: 28, color: "var(--accent)" }} />
          <strong>{fileName || "Click to choose a .csv file"}</strong>
          <span className="hint">{rows.length ? `${rows.length} rows found` : "Up to a few thousand products at a time"}</span>
        </label>
        {error && <div className="alert alert-error"><AlertCircle />{error}</div>}
        {rows.length > 0 && (
          <>
            <div className="hint">Columns used: {mapped.map((f) => LABEL[f]).join(", ")}{ignored.length > 0 && `. Ignored: ${ignored.join(", ")}`}</div>
            {mapped.includes("stock") && (
              <div className="field">
                <span className="label">The stock column is</span>
                <div className="tabs" role="radiogroup" style={{ flexWrap: "wrap" }}>
                  <button type="button" role="radio" aria-checked={stockMode === "set"} className="tab" data-active={stockMode === "set"} style={{ border: 0, cursor: "pointer" }} onClick={() => setStockMode("set")}>Current stock count (replace)</button>
                  <button type="button" role="radio" aria-checked={stockMode === "add"} className="tab" data-active={stockMode === "add"} style={{ border: 0, cursor: "pointer" }} onClick={() => setStockMode("add")}>Quantity received (add)</button>
                </div>
                <span className="hint">
                  {stockMode === "set" ? "Products already in the app get their stock set to this number. Use this for your first import or after a stock count." : "The number is added to the stock already in the app. Use this for a supplier delivery."} An empty stock cell leaves stock unchanged.
                </span>
              </div>
            )}
          </>
        )}
      </section>

      {rows.length > 0 && (
        <section className="card stack" style={{ padding: 0, overflow: "hidden" }}>
          <div className="row wrap between" style={{ padding: "18px 22px 0" }}>
            <span className="card-title">3. Check and import</span>
            <span className="row" style={{ "--gap": "8px" } as React.CSSProperties}>
              <span className="badge badge-COMPLETED">{good.length} ready</span>
              {bad > 0 && <span className="badge badge-REWORK">{bad} with problems</span>}
            </span>
          </div>
          <p className="hint" style={{ padding: "0 22px" }}>Rows with the same barcode or SKU as a product already in the app update that product. Everything else is added as new. Rows with problems are skipped.</p>
          <div className="table-wrap" style={{ maxHeight: 460, overflowY: "auto" }}>
            <table className="table">
              <thead><tr><th>Line</th><th>Name</th><th className="hide-sm">Category</th><th className="hide-sm">Barcode / SKU</th><th className="num">MRP</th><th className="num">Stock</th><th>Status</th></tr></thead>
              <tbody>
                {rows.slice(0, 300).map((r) => (
                  <tr key={r.line}>
                    <td className="muted mono">{r.line}</td>
                    <td style={{ fontWeight: 650 }}>{r.data.name || <span className="muted">—</span>}</td>
                    <td className="hide-sm text-2">{r.data.categoryName}</td>
                    <td className="hide-sm mono" style={{ fontSize: 13 }}>{r.data.barcode || r.data.sku || <span className="muted">new SKU</span>}</td>
                    <td className="num">{r.data.mrp && `₹${r.data.mrp}`}</td>
                    <td className="num">{r.data.stock || <span className="muted">—</span>}</td>
                    <td>{r.problems.length ? <span className="error-text">{r.problems.join("; ")}</span> : <span className="badge badge-COMPLETED">Ready</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 300 && <p className="hint" style={{ padding: "0 22px" }}>Showing the first 300 rows. All {rows.length} will be imported.</p>}
          <div className="row" style={{ padding: "0 22px 20px", justifyContent: "flex-end" }}>
            <button className="btn btn-primary btn-lg" disabled={good.length === 0 || progress !== null} onClick={runImport}>
              {progress !== null ? <><span className="spinner" /> {progress} / {good.length}</> : <><Upload /> Import {good.length} product{good.length === 1 ? "" : "s"}</>}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
