// Small fixed-window limiter for login and password reset endpoints.
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 10, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  h.count++;
  return h.count <= limit;
}
