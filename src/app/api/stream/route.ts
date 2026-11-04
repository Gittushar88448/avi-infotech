import { getSession } from "@/lib/auth";
import { subscribe } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent Events: one long-lived connection per open tab.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const write = (s: string) => {
        try { controller.enqueue(enc.encode(s)); } catch { cleanup(); }
      };
      write(`retry: 3000\ndata: ${JSON.stringify({ type: "hello" })}\n\n`);
      const unsubscribe = subscribe(session.uid, (e) => write(`data: ${JSON.stringify(e)}\n\n`));
      const ping = setInterval(() => write(`: ping\n\n`), 20000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        try { controller.close(); } catch {}
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
