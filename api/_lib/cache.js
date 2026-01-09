// api/_lib/cache.js
const mem = new Map();

/**
 * Simple in-memory TTL cache (good enough for local dev).
 */
export function cacheGet(key) {
  const v = mem.get(key);
  if (!v) return null;
  if (v.expiresAt && Date.now() > v.expiresAt) {
    mem.delete(key);
    return null;
  }
  return v.value;
}

export function cacheSet(key, value, ttlMs = 0) {
  mem.set(key, {
    value,
    expiresAt: ttlMs ? Date.now() + ttlMs : 0,
  });
}
