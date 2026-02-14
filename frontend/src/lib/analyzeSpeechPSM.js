// src/lib/analyzeSpeechPSM.js

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? Math.max(0, Math.min(1, n)) : Math.max(0, Math.min(1, n / 100));
}

// PSM-style: duration-weighted phoneme score -> word score (0-100)
function wordScore100LikePSM(wordObj) {
  const phs = Array.isArray(wordObj?.phonemes) ? wordObj.phonemes : [];
  if (!phs.length) return null;

  let num = 0;
  let den = 0;

  for (const ph of phs) {
    const s01 = clamp01(
      ph.pronunciation ??
        ph.accuracy_score ??
        ph.pronunciation_score ??
        ph.score ??
        ph.accuracy ??
        ph.accuracyScore
    );
    if (s01 == null) continue;

    const span = ph.span || ph.time || null;
    const start10 = span?.start ?? span?.s ?? null;
    const end10 = span?.end ?? span?.e ?? null;

    const dur =
      typeof start10 === "number" && typeof end10 === "number" && end10 > start10
        ? (end10 - start10) * 0.01
        : 1;

    num += s01 * dur;
    den += dur;
  }

  if (!den) return null;
  return Math.round((num / den) * 100);
}

// PSM-style: sentence score = avg of word scores (ignore nulls)
function psmSentenceScoreFromApi(json) {
  const apiWords = Array.isArray(json?.words) ? json.words : [];
  const wordScores = apiWords.map((w) => wordScore100LikePSM(w)).filter((v) => Number.isFinite(v));
  const overall = wordScores.length ? Math.round(wordScores.reduce((a, b) => a + b, 0) / wordScores.length) : 0;
  return { overall, wordScores };
}

// PSM-style word scores IN ORDER (keep nulls to preserve positions)
function wordScoresInOrder(wordsArr) {
  const ws = Array.isArray(wordsArr) ? wordsArr : [];
  return ws.map((w) => wordScore100LikePSM(w));
}

/**
 * Runs SpeechSuper analyze + applies Record.jsx canonical PSM scoring:
 * - word score = duration-weighted avg phoneme score
 * - sentence overall = avg of word scores
 * - overwrites json.overall/pronunciation/overallAccuracy with PSM overall
 */
export async function analyzeSpeechPSM({
  base,
  audioBlob,
  refText,
  accent, // "en_us" | "en_br"
  timeoutMs = 12000,
  filename = "clip.webm",
  slack, // optional number (e.g. 1)
}) {

  if (!base) throw new Error("API base is missing.");
  if (!audioBlob) throw new Error("audioBlob is missing.");

  const fd = new FormData();
  fd.append("audio", audioBlob, filename);
  fd.append("refText", String(refText || ""));
  fd.append("accent", accent === "en_br" ? "en_br" : "en_us");
if (slack != null && slack !== "") {
  fd.append("slack", String(slack));
}

  const controller = new AbortController();
  const t = setTimeout(() => {
    try {
      controller.abort();
    } catch {}
  }, timeoutMs);

  let r;
  let json = {};
  let psm = null;

  try {
    r = await fetch(`${base}/api/analyze-speech`, {
      method: "POST",
      body: fd,
      signal: controller.signal,
    });

    clearTimeout(t);

    const ct = r.headers?.get("content-type") || "";
    if (ct.includes("application/json")) {
      json = await r.json().catch(() => ({}));
    } else {
      const txt = await r.text().catch(() => "");
      json = txt ? { error: txt } : {};
    }

    if (!r.ok) throw new Error(json?.error || r.statusText || "Analyze failed");

    // ✅ PSM scoring
    psm = psmSentenceScoreFromApi(json);

    // ✅ overwrite like Record.jsx canonical behavior
    json = {
      ...json,
      overall: psm.overall,
      pronunciation: psm.overall,
      overallAccuracy: psm.overall,
    };

    return {
      json,
      psmOverall: Number(psm?.overall ?? 0),
      psmWordScoresInOrder: wordScoresInOrder(json?.words),
    };
  } catch (e) {
    clearTimeout(t);
    if (e?.name === "AbortError") throw new Error("Analysis timed out. Please try again.");
    throw e;
  }
}
