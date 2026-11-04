import { apiSession } from "@/lib/auth";
import { readImage } from "@/lib/storage";

// Completion photos are only visible to signed-in staff.
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!(await apiSession())) return new Response("Unauthorized", { status: 401 });
  const file = await readImage((await params).name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.type, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
  });
}
