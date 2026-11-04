import "server-only";
import { NextResponse } from "next/server";
import type { ZodTypeAny, output } from "zod";

export const ok = (data: object = { ok: true }) => NextResponse.json(data);
export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function parseJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<{ data: output<S> } | { error: NextResponse }> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: fail(issue ? `${issue.path.join(".") || "Request"}: ${issue.message}` : "Invalid request") };
  }
  return { data: parsed.data };
}
