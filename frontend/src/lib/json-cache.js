// src/lib/json-cache.js
const MEM = new Map(); // key -> { t:number, data:any }
const DEFAULT_MAX_AGE = 60_000; // 60s

export function getCached(key, maxAgeMs = DEFAULT_MAX_AGE) {
  const hit = MEM.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > maxAgeMs) { MEM.delete(key); return null; }
  return hit.data;
}

export function setCached(key, data) {
  MEM.set(key, { t: Date.now(), data });
}

export async function fetchJSONCached(url, { maxAgeMs = DEFAULT_MAX_AGE, init } = {}) {
  const key = url;
  const cached = getCached(key, maxAgeMs);
  if (cached) return { data: cached, fromCache: true };

  const r = await fetch(url, init);
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || r.statusText || "Request failed");
  setCached(key, data);
  return { data, fromCache: false };
}

export function prefetchJSON(url) {
  // fire-and-forget
  try {
    if (getCached(url)) return;
    (window.requestIdleCallback
      ? window.requestIdleCallback
      : (cb) => setTimeout(cb, 300))(() => {
        fetchJSONCached(url).catch(() => {});
      });
  } catch {}
}
