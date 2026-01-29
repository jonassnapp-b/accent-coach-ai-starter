// frontend/src/lib/localPhonemeStats.js
// Stores phoneme attempts + running average per accent in localStorage.
// This is used to ensure Coach/Imitate attempts show up in WeaknessLab too.

function key(accent = "en_us") {
  return `ac_local_phoneme_stats_v1:${String(accent).toLowerCase()}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function normPh(p) {
  return String(p || "").trim().toUpperCase().replaceAll("/", "");
}

export function loadLocalPhonemeStats(accent) {
  try {
    const raw = localStorage.getItem(key(accent));
    const obj = raw ? JSON.parse(raw) : {};
    if (!obj || typeof obj !== "object") return {};
    return obj;
  } catch {
    return {};
  }
}

export function saveLocalPhonemeStats(accent, obj) {
  try {
    localStorage.setItem(key(accent), JSON.stringify(obj || {}));
  } catch {}
}

/**
 * Ingest a phoneme score map/array from any source (Record or Coach/Imitate).
 *
 * Accepted formats:
 * 1) { "TH": 82, "AE": 55, ... } (0-100 or 0-1)
 * 2) [{ phoneme:"TH", score:82 }, { label:"AE", avg:0.55 }, ...]
 */
export function ingestLocalPhonemeScores(accent, phonemesAny) {
  const a = String(accent || "en_us").toLowerCase();
  const prev = loadLocalPhonemeStats(a);

  // Convert to iterable [phoneme, pct]
  const pairs = [];

  if (Array.isArray(phonemesAny)) {
    for (const item of phonemesAny) {
      const ph = normPh(item?.phoneme ?? item?.label ?? item?.p ?? item?.symbol ?? item?.key);
      if (!ph) continue;

      const raw = item?.score ?? item?.avg ?? item?.value ?? item?.accuracy ?? item?.pct;
      const n = Number(raw);
      if (!isFinite(n)) continue;

      const pct = clamp(Math.round(n <= 1 ? n * 100 : n), 0, 100);
      pairs.push([ph, pct]);
    }
  } else if (phonemesAny && typeof phonemesAny === "object") {
    for (const [k, v] of Object.entries(phonemesAny)) {
      const ph = normPh(k);
      if (!ph) continue;

      const n = Number(v);
      if (!isFinite(n)) continue;

      const pct = clamp(Math.round(n <= 1 ? n * 100 : n), 0, 100);
      pairs.push([ph, pct]);
    }
  }

  if (!pairs.length) return;

  // Update running stats
  const next = { ...prev };

  for (const [ph, pct] of pairs) {
    const cur = next[ph] || { count: 0, avg: 0, best: 0 };
    const count = (Number(cur.count) || 0) + 1;

    const prevAvg = Number(cur.avg) || 0;
    const avg = Math.round((prevAvg * (count - 1) + pct) / count);

    const best = Math.max(Number(cur.best) || 0, pct);

    next[ph] = { count, avg, best };
  }

  saveLocalPhonemeStats(a, next);
}
