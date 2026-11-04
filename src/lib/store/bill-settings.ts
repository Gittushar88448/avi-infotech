// The shop's details for bills (name, address, GSTIN, bank, declaration) and which sections
// each kind of bill shows. Stored in one document; .env STORE_* values are the starting defaults.
import "server-only";
import { BillSettings, type ISeller } from "./models";
import { SECTIONS, defaultSections, type BillType, type SectionKey } from "./bill-format";
import type { BillSettingsData } from "./schemas";

const DEFAULT_DECLARATION = "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";

function envDefaults(): ISeller {
  return {
    companyName: process.env.APP_NAME || "Avi Infotech",
    address: process.env.STORE_ADDRESS || "",
    phone: process.env.STORE_PHONE || "",
    email: process.env.STORE_EMAIL || "",
    gstin: process.env.STORE_GSTIN || "",
    pan: "",
    stateName: "",
    stateCode: "",
    licences: "",
    bankHolder: "",
    bankName: "",
    bankAccount: "",
    bankBranchIfsc: "",
    declaration: DEFAULT_DECLARATION,
    terms: process.env.INVOICE_TERMS || "Goods once sold will not be taken back. Warranty as per manufacturer terms; keep this bill for warranty claims.",
  };
}

const known = new Set<string>(SECTIONS.map((s) => s.key));

export async function getBillSettings() {
  const doc = await BillSettings.findById("default").lean();
  const base = envDefaults();
  const seller: ISeller = { ...base };
  if (doc) for (const k of Object.keys(base) as (keyof ISeller)[]) if (typeof doc[k] === "string") seller[k] = doc[k];
  return {
    seller,
    sections: {
      PLAIN: (doc?.plainSections?.filter((k) => known.has(k)) ?? defaultSections("PLAIN")) as SectionKey[],
      GST: (doc?.gstSections?.filter((k) => known.has(k)) ?? defaultSections("GST")) as SectionKey[],
    } satisfies Record<BillType, SectionKey[]>,
  };
}
export type BillSettingsDTO = Awaited<ReturnType<typeof getBillSettings>>;

export async function saveBillSettings(data: BillSettingsData) {
  const { plainSections, gstSections, ...seller } = data;
  await BillSettings.updateOne({ _id: "default" }, { $set: { ...seller, plainSections, gstSections } }, { upsert: true });
}
