// Money helpers, shared by server and browser code.
// Every amount is stored as an integer number of paise (₹1 = 100 paise) so totals never drift.

export type Paise = number;

export const toPaise = (rupees: number): Paise => Math.round(rupees * 100);
export const toRupees = (paise: Paise) => paise / 100;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrShort = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** ₹1,23,456.00 */
export const formatINR = (paise: Paise) => inr.format(paise / 100);
/** ₹1,23,456 (rounded, for dashboards) */
export const formatINRShort = (paise: Paise) => inrShort.format(Math.round(paise / 100));

/** GST bills are INV-00001, plain bills BILL-00001 (two separate number series). */
export const invoiceCode = (n: number, billType?: string | null) => `${billType === "PLAIN" ? "BILL" : "INV"}-${String(n).padStart(5, "0")}`;
/** Quotations are numbered QT-00001. */
export const quoteCode = (n: number) => `QT-${String(n).padStart(5, "0")}`;
export const skuCode = (n: number) => `AVI-${String(n).padStart(5, "0")}`;

export const PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK", "CREDIT"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export const PAYMENT_LABEL: Record<PaymentMode, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", BANK: "Bank transfer", CREDIT: "Credit (pay later)" };

/** Common Indian GST slabs. Camera and security hardware is usually 18%. */
export const GST_RATES = [0, 5, 12, 18, 28] as const;

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const twoDigits = (n: number) => (n < 20 ? ONES[n]! : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const threeDigits = (n: number) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : "", twoDigits(n % 100)].filter(Boolean).join(" ");

/** Indian numbering in words, as printed on bills: "Twelve Thousand Five Hundred Rupees Only". */
export function amountInWords(paise: Paise) {
  let n = Math.floor(Math.abs(paise) / 100);
  const p = Math.abs(paise) % 100;
  if (n === 0 && p === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000); n %= 10_000_000;
  const lakh = Math.floor(n / 100_000); n %= 100_000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  const rupees = parts.length ? `${parts.join(" ")} Rupees` : "";
  return `${[rupees, p ? `${twoDigits(p)} Paise` : ""].filter(Boolean).join(" and ")} Only`;
}
