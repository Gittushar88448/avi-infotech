// In-process pub/sub that feeds the Server-Sent Events stream.
// One Node process is enough for a single-server deployment. To run several
// instances, replace emit/subscribe with Redis pub/sub; nothing else changes.
import { EventEmitter } from "events";

export type LiveEvent =
  | { type: "notification"; notification: { id: string; title: string; body: string; link: string | null; createdAt: string } }
  | { type: "refresh"; queryId?: string }
  | { type: "location"; userId: string; lat: number; lng: number; accuracy: number; at: string }
  | { type: "tracking"; enabled: boolean };

const g = globalThis as unknown as { __fdBus?: EventEmitter };
const bus =
  g.__fdBus ??
  (() => {
    const e = new EventEmitter();
    e.setMaxListeners(0);
    return e;
  })();
g.__fdBus = bus;

export function emitToUser(userId: string, event: LiveEvent) {
  bus.emit(`user:${userId}`, event);
}

export function subscribe(userId: string, fn: (e: LiveEvent) => void) {
  bus.on(`user:${userId}`, fn);
  return () => bus.off(`user:${userId}`, fn);
}
