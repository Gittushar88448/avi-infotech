import "server-only";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

// Local-disk storage. Swap these two functions for S3/R2/GCS in a multi-server deployment.
const dir = () => path.resolve(process.env.UPLOAD_DIR || "./uploads");

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
/** Purchase bills can also be PDFs. */
const DOC_TYPES: Record<string, string> = { ...TYPES, "application/pdf": "pdf" };
export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(DOC_TYPES).map(([m, e]) => [e, m]));

export async function saveImage(file: File) {
  const ext = TYPES[file.type];
  if (!ext) throw new Error(`Unsupported image type: ${file.type || "unknown"}`);
  const max = Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024;
  if (file.size > max) throw new Error(`Each photo must be under ${process.env.MAX_UPLOAD_MB || 10} MB`);
  await mkdir(dir(), { recursive: true });
  const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  await writeFile(path.join(dir(), name), Buffer.from(await file.arrayBuffer()));
  return name;
}

/** Saves a scanned bill: a photo or a PDF. */
export async function saveDocument(file: File) {
  const ext = DOC_TYPES[file.type] ?? (/\.pdf$/i.test(file.name) ? "pdf" : undefined);
  if (!ext) throw new Error(`"${file.name}" isn't a photo or PDF`);
  const max = Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024;
  if (file.size > max) throw new Error(`Each file must be under ${process.env.MAX_UPLOAD_MB || 10} MB`);
  await mkdir(dir(), { recursive: true });
  const name = `bill-${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  await writeFile(path.join(dir(), name), Buffer.from(await file.arrayBuffer()));
  return { name, original: file.name.slice(0, 160), type: MIME_BY_EXT[ext]!, size: file.size };
}

export async function readImage(name: string) {
  if (!/^[\w-]+\.(jpg|png|webp|heic|heif|pdf)$/.test(name)) return null;
  try {
    return { data: await readFile(path.join(dir(), name)), type: MIME_BY_EXT[name.split(".").pop()!] };
  } catch {
    return null;
  }
}
