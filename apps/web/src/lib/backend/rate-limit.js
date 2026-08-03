const buckets = new Map();

function consume(identifier, limit, windowMs) {
  const now = Date.now();
  const current = buckets.get(identifier);
  if (!current || current.resetAt <= now) {
    buckets.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterMs: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: current.resetAt - now };
  }
  current.count += 1;
  return { allowed: true, remaining: limit - current.count, retryAfterMs: 0 };
}

module.exports = { consume };
