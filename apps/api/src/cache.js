const entries = new Map();

function normalizeQuery(query) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function get(cacheKey) {
  const entry = entries.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    entries.delete(cacheKey);
    return null;
  }
  return entry.value;
}

function set(cacheKey, value, ttlMs) {
  entries.set(cacheKey, { value, expiresAt: Date.now() + ttlMs });
}

module.exports = { get, normalizeQuery, set };
