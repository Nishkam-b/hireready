// Simple in-memory sliding-window rate limiter (per client IP).
// For multi-instance deployments swap this for a shared store such as Redis.
export function rateLimit({ windowMs = 60_000, max = 20 } = {}) {
  const hits = new Map();
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [k, arr] of hits) {
      const kept = arr.filter((t) => t > cutoff);
      if (kept.length) hits.set(k, kept); else hits.delete(k);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => t > now - windowMs);
    if (arr.length >= max) {
      const retry = Math.ceil((arr[0] + windowMs - now) / 1000);
      res.set('Retry-After', String(retry));
      return res.status(429).json({ error: `Too many AI requests. Please wait ${retry}s and try again.` });
    }
    arr.push(now);
    hits.set(key, arr);
    res.set('X-RateLimit-Remaining', String(max - arr.length));
    next();
  };
}
