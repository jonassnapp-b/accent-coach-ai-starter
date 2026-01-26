// src/components/PhonemeFeedback.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Volume2, ChevronRight } from "lucide-react";
import { toggleBookmark, isBookmarked } from "../lib/bookmarks.js";
import { useSettings } from "../lib/settings-store.jsx";
import { playAudioSegment } from "../lib/audioClipper.js";
import { getCoachFeedback } from "../lib/phonemeCoach";
import { burstConfetti } from "../lib/celebrations.js";
import { calculateOverallScoreModelB } from "../lib/scoring/calculateOverallScoreModelB";
import { motion } from "framer-motion";


const IS_PROD = !!import.meta?.env?.PROD;

if (!IS_PROD) console.log("PF LIVE v41 (LIGHT ONLY)", import.meta?.url);

/* ------------ API base (web + native) ------------ */
function isNative() {
  return !!(window?.Capacitor && window.Capacitor.isNativePlatform);
}
function getApiBase() {
  const ls = (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) || "";
  const env = (import.meta?.env && import.meta.env.VITE_API_BASE) || "";
  if (isNative()) {
    const base = (ls || env).replace(/\/+$/, "");
    if (!base) throw new Error("VITE_API_BASE (eller localStorage.apiBase) er ikke sat – krævet på iOS.");
    return base;
  }
  return (ls || env || window.location.origin).replace(/\/+$/, "");
}

/* ---------- helpers ---------- */
function getWordSpanSec(apiWord) {
  const phs = Array.isArray(apiWord?.phonemes) ? apiWord.phonemes : [];
  if (!phs.length) return null;

  let start10 = null;
  let end10 = null;

  for (const ph of phs) {
    const span = ph.span || ph.time || null;
    const s = span?.start ?? span?.s ?? null;
    const e = span?.end ?? span?.e ?? null;

    if (typeof s === "number") start10 = start10 == null ? s : Math.min(start10, s);
    if (typeof e === "number") end10 = end10 == null ? e : Math.max(end10, e);
  }

  if (start10 == null || end10 == null || end10 <= start10) return null;

  // 10ms -> seconds + a little padding
  const startSec = Math.max(0, start10 * 0.01 - 0.08);
  const endSec = end10 * 0.01 + 0.10;

  return { startSec, endSec };
}

async function playTrimmedUserWord(result, wordIndex = 0, { volume = 1 } = {}) {
  const words = Array.isArray(result?.words) ? result.words : [];
  const apiWord = words[wordIndex];
  if (!apiWord) return false;

  const span = getWordSpanSec(apiWord);
  if (!span) return false;

  const url =
    result?.userAudioUrl ||
    result?.audioUrl ||
    result?.recordingUrl ||
    result?.audio?.url ||
    result?.userAudio?.url ||
    null;

  const blob = result?.userAudioBlob || null;

  try {
    await playAudioSegment(blob || url, span.startSec, span.endSec, { volume });
    return true;
  } catch {
    return false;
  }
}


function to01(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  return n <= 1 ? Math.max(0, Math.min(1, n)) : Math.max(0, Math.min(1, n / 100));
}

function scoreToColor01(s) {
  const x = Math.max(0, Math.min(1, Number(s) || 0));
  return `hsl(${x * 120}deg 75% 45%)`;
}

function splitEvenly(text, n) {
  const s = String(text || "");
  if (!n || n <= 1) return [s];
  const chars = Array.from(s);
  const len = chars.length;
  const base = Math.floor(len / n);
  const rem = len % n;

  const out = [];
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const take = base + (i < rem ? 1 : 0);
    out.push(chars.slice(idx, idx + take).join(""));
    idx += take;
  }
  return out;
}

/* ====== SpeechSuper -> CMU mapping (only used if input is NOT already CMU) ====== */
const KK_TO_CMU = {
  // vowels
  "ɔ": "AO",
  "ɔː": "AO",
  "ɒ": "OH",
  "ɑ": "AA",
  "ɑː": "AA",
  a: "AA",
  i: "IX",
  "ɪ": "IH",
  "iː": "IY",
  u: "UX",
  "ʊ": "UH",
  "uː": "UW",
  "ɛ": "EH",
  e: "EY",
  "eɪ": "EY",
  ei: "EY",
  "ə": "AX",
  "ʌ": "AH",
  "æ": "AE",
  "aɪ": "AY",
  ai: "AY",
  "oʊ": "OW",
  "əʊ": "OW",
  ou: "OW",
  o: "OW",
  "aʊ": "AW",
  au: "AW",
  "ɔɪ": "OY",
  "ɔi": "OY",
  "ɚ": "AXR",
  "ɝ": "AXR",
  "ɜr": "AXR",
  "ɜːr": "AXR",
  "ɜːɹ": "AXR",
  ər: "AXR",

  // consonants
  p: "P",
  b: "B",
  t: "T",
  d: "D",
  k: "K",
  g: "G",
  "tʃ": "CH",
  "dʒ": "JH",
  f: "F",
  v: "V",
  θ: "TH",
  ð: "DH",
  s: "S",
  z: "Z",
  ʃ: "SH",
  "ʒ": "ZH",
  h: "HH",
  m: "M",
  n: "N",
  ŋ: "NG",
  l: "L",
  r: "R",
  ɹ: "R",
  w: "W",
  j: "Y",
};

const CMU_VOWELS = new Set([
  "AA",
  "AE",
  "AH",
  "AO",
  "AW",
  "AY",
  "EH",
  "ER",
  "EY",
  "IH",
  "IY",
  "OW",
  "OY",
  "UH",
  "UW",
  "AX",
  "IX",
  "UX",
  "AXR",
  "OH",
]);

const CMU_DISPLAY = {
  AX: "uh",
  AH: "uh",
  IX: "ih",
  IH: "ih",
  IY: "EE",
  EH: "EH",
  AE: "AE",
  AA: "AA",
  AO: "AO",
  OH: "OH",
  UH: "UH",
  UW: "oo",
  UX: "oo",
  AXR: "er",
  ER: "er",
  EY: "EY",
  AY: "AY",
  OW: "OW",
  OY: "OY",
  AW: "AW",
};

const CMU_HELP = {
  TH: "th",
  DH: "th",

  IX: "ih",
  IH: "ih",
  IY: "ee",

  AX: "uh",
  AH: "uh",
  ER: "er",
  AXR: "er",

  UW: "oo",
  UX: "oo",
  UH: "oo",

  SH: "sh",
  ZH: "zh",
  CH: "ch",
  JH: "j",

  NG: "ng",
};



function isProbablyCMU(sym) {
  return /^[A-Z]{1,3}$/.test(String(sym || "").trim());
}

function normalizePhonemeSym(sym) {
  if (!sym) return "";
  let s = String(sym).trim();
  s = s.replace(/^\/+|\/+$/g, "");
  s = s.replace(/[ˈˌ.]/g, "");
  s = s.replace(/:/g, "ː");
  s = s.replace(/\s+/g, "");
  return s;
}

function toCMU(symRaw) {
  const raw = String(symRaw || "").trim();
  if (!raw) return "";
  if (isProbablyCMU(raw)) return raw;
  const s = normalizePhonemeSym(raw);
  if (KK_TO_CMU[s]) return KK_TO_CMU[s];
  return s.toUpperCase();
}

function isVowelCMU(t) {
  return CMU_VOWELS.has(String(t || "").trim());
}

function cmuPrettyToken(cmu) {
  const t = String(cmu || "").trim();
  if (!t) return "";
  if (isVowelCMU(t)) return CMU_DISPLAY[t] ?? t;
  return t.toLowerCase();
}

function cmuChipLabel(cmu) {
  const t = String(cmu || "").trim();
  if (!t) return "";

  // If we have a friendly help label, use it.
  const help = CMU_HELP[t];
  if (help) return help;

  // Otherwise: keep existing behavior (vowels mapped, consonants lowercase)
  return cmuPrettyToken(t);
}


function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/**
 * ✅ Chunking logic
 */
function chunkCmuIndexesSmart(cmuTokens) {
  const cmu = (Array.isArray(cmuTokens) ? cmuTokens : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  const vowelIdxs = [];
  for (let i = 0; i < cmu.length; i++) if (isVowelCMU(cmu[i])) vowelIdxs.push(i);

  if (!vowelIdxs.length) return cmu.length ? [cmu.map((_, i) => i)] : [];

  const chunks = [];
  let start = 0;

  for (let v = 0; v < vowelIdxs.length; v++) {
    const vIdx = vowelIdxs[v];
    const nextVIdx = v + 1 < vowelIdxs.length ? vowelIdxs[v + 1] : null;

    if (nextVIdx == null) {
      chunks.push(range(start, cmu.length - 1));
      break;
    }

    const consRunStart = vIdx + 1;
    const consRunEnd = nextVIdx - 1;
    const consLen = consRunEnd >= consRunStart ? consRunEnd - consRunStart + 1 : 0;

    if (consLen <= 0) {
      chunks.push(range(start, nextVIdx - 1));
      start = nextVIdx;
      continue;
    }

    if (consLen === 1) {
      chunks.push(range(start, consRunEnd));
      start = nextVIdx;
      continue;
    }

    chunks.push(range(start, consRunEnd - 1));
    start = consRunEnd;
  }

  return chunks.filter((c) => c.length);
}

/* --- mapping from API phoneme object --- */
function readPhoneme(o = {}) {
  const letters = o.spelling ?? o.letters ?? o.grapheme ?? o.text ?? "";
  const sym = o.phoneme ?? o.ph ?? o.phone ?? o.sound ?? o.ipa ?? o.symbol ?? "";
  const s01 = to01(o.pronunciation ?? o.accuracy_score ?? o.pronunciation_score ?? o.score ?? o.accuracy ?? o.accuracyScore);

  // SpeechSuper spans are typically in 10ms units.
  const spanObj = o.span || o.time || null;
  const start10 = spanObj?.start ?? spanObj?.s ?? null;
  const end10 = spanObj?.end ?? spanObj?.e ?? null;

  // keep both raw + seconds
  const startSec = typeof start10 === "number" ? start10 * 0.01 : null;
  const endSec = typeof end10 === "number" ? end10 * 0.01 : null;
  const dur = startSec != null && endSec != null && endSec > startSec ? endSec - startSec : null;

  return { letters, sym, s01, dur, startSec, endSec };
}

/**
 * Build letters-per-phoneme index using SpeechSuper `phonics[]`
 */
function buildLettersByIdxFromPhonics(phonicsArr, cmuTokens) {
  const phonics = Array.isArray(phonicsArr) ? phonicsArr : [];
  const cmu = Array.isArray(cmuTokens) ? cmuTokens : [];

  const expanded = [];
  for (const item of phonics) {
    const spell = String(item?.spell ?? item?.spelling ?? item?.letters ?? item?.text ?? "");
    const phArr = item?.phoneme ?? item?.phonemes ?? item?.phones ?? item?.ph ?? [];
    const phones = Array.isArray(phArr) ? phArr.map((x) => String(x || "").trim()).filter(Boolean) : [];
    if (!phones.length) continue;

    const pieces = splitEvenly(spell, phones.length);
    for (let i = 0; i < phones.length; i++) {
      expanded.push({
        phone: toCMU(phones[i]),
        letters: pieces[i] ?? "",
      });
    }
  }

  if (expanded.length === cmu.length && cmu.length) return expanded.map((x) => x.letters);

  const out = Array(cmu.length).fill("");
  let j = 0;
  for (let i = 0; i < cmu.length; i++) {
    if (j < expanded.length) {
      out[i] = expanded[j].letters;
      j++;
    }
  }
  return out;
}

/* colorized helpers for sentence view */
function coloredGraphemesOfWord(w) {
  const phs = Array.isArray(w?.phonemes) ? w.phonemes : [];
  const wordText = w?.word ?? w?.w ?? "";
  if (!phs.length) return <span>{wordText}</span>;

  const phonics = Array.isArray(w?.phonics) ? w.phonics : [];
  if (phonics.length) {
    const segs = phonics.map((p, i) => {
      const spell = String(p?.spell ?? "");
      const ov = to01(p?.overall ?? p?.score ?? p?.accuracy ?? p?.accuracyScore) ?? null;
      return { key: `phx-${i}`, text: spell, s01: ov };
    });
    return segs.map((s) => (
      <span key={s.key} style={{ color: scoreToColor01(s.s01 ?? 0) }}>
        {s.text}
      </span>
    ));
  }

  // Fallback: split the word into N parts (N = phoneme count) and color each part by phoneme score
const meta = phs.map((p) => readPhoneme(p));
const pieces = splitEvenly(wordText, meta.length || 1);

return (
  <span>
    {pieces.map((txt, i) => (
      <span key={`phseg-${i}`} style={{ color: scoreToColor01(meta[i]?.s01 ?? 0) }}>
        {txt}
      </span>
    ))}
  </span>
);

}

function SentenceHeroWord({ words, ui }) {
  if (!Array.isArray(words) || !words.length) return null;

  return (
    <div className="pf-hero-word" style={{ color: ui.textStrong }}>
      {words.map((w, wi) => (
        <span key={`sw-${wi}`} className="mr-2">
          {coloredGraphemesOfWord(w)}
        </span>
      ))}
    </div>
  );
}


function ProgressRing({ pct = 0 }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
const r = 16; // +2 px → mere luft, stadig elegant
  const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;

  return (
    <div className="pf-ring" aria-label={`Progress ${p}%`}>
      <svg width="38" height="38" viewBox="0 0 38 38">
        <circle cx="19" cy="19" r={r} stroke="rgba(0,0,0,0.10)" strokeWidth="4" fill="none" />
        <circle
          cx="19"
          cy="19"
          r={r}
          stroke="rgba(33,150,243,0.95)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 19 19)"
        />
      </svg>
      <span>{p}%</span>
    </div>
  );
}
function buildChunkRowsFromWord(wordObj, fallbackWordText = "") {
  const wordText = String(wordObj?.word ?? wordObj?.w ?? fallbackWordText ?? "").trim();
  const phs = Array.isArray(wordObj?.phonemes) ? wordObj.phonemes : [];
  const phonics = Array.isArray(wordObj?.phonics) ? wordObj.phonics : [];

  if (!phs.length) return [];

  const meta = phs.map((p) => readPhoneme(p));
  const cmuTokens = meta.map((m) => toCMU(m.sym)).filter(Boolean);
  if (!cmuTokens.length) return [];

  const scoresByIdx = meta.map((m) => (typeof m.s01 === "number" ? m.s01 : 0));
  const weightsByIdx = meta.map((m) => (typeof m.dur === "number" ? m.dur : 1));
  const spansByIdx = meta.map((m) => ({ startSec: m.startSec, endSec: m.endSec }));

  const lettersByIdx = buildLettersByIdxFromPhonics(phonics, cmuTokens);
  const chunks = chunkCmuIndexesSmart(cmuTokens);

  const chunkScores = chunks.map((idxs) => {
    let num = 0;
    let den = 0;
    for (const ix of idxs) {
      const s = typeof scoresByIdx[ix] === "number" ? scoresByIdx[ix] : 0;
      const w = typeof weightsByIdx[ix] === "number" ? weightsByIdx[ix] : 1;
      num += s * w;
      den += w;
    }
    return den > 0 ? num / den : 0;
  });

  let rows = chunks.map((idxs, i) => {
    const letters = idxs.map((ix) => String(lettersByIdx[ix] || "")).join("");
    const pct = Math.round((chunkScores?.[i] ?? 0) * 100);

    // USER chunk span
    let minS = null;
    let maxE = null;
    for (const ix of idxs) {
      const s = spansByIdx[ix]?.startSec;
      const e = spansByIdx[ix]?.endSec;
      if (typeof s === "number" && typeof e === "number" && e > s) {
        if (minS == null || s < minS) minS = s;
        if (maxE == null || e > maxE) maxE = e;
      }
    }

    const phonemes = idxs.map((ix) => {
      const s01 = scoresByIdx[ix] ?? 0;
      const span = spansByIdx[ix] || {};
      return {
        ix,
        cmu: cmuTokens[ix],
        pretty: cmuPrettyToken(cmuTokens[ix]),
        pct: Math.round((s01 ?? 0) * 100),
        s01,
        startSec: span.startSec ?? null,
        endSec: span.endSec ?? null,
      };
    });

    return { i, idxs, letters, pct, phonemes, startSec: minS, endSec: maxE };
  });

  // merge empty-letter rows into previous
  for (let i = 0; i < rows.length; i++) {
    const letters = String(rows[i]?.letters || "").trim();
    if (letters) continue;

    let j = i - 1;
    while (j >= 0 && !String(rows[j]?.letters || "").trim()) j--;

    if (j >= 0) {
      const a = rows[j];
      const b = rows[i];

      rows[j] = {
        ...a,
        idxs: [...(a.idxs || []), ...(b.idxs || [])],
        phonemes: [...(a.phonemes || []), ...(b.phonemes || [])],
        startSec: a.startSec != null ? a.startSec : b.startSec,
        endSec:
          Math.max(a.endSec ?? -Infinity, b.endSec ?? -Infinity) > -Infinity
            ? Math.max(a.endSec ?? -Infinity, b.endSec ?? -Infinity)
            : null,
        pct: Math.round(
          ((a.pct ?? 0) * ((a.phonemes || []).length || 1) + (b.pct ?? 0) * ((b.phonemes || []).length || 1)) /
            (((a.phonemes || []).length || 1) + ((b.phonemes || []).length || 1))
        ),
      };

      rows[i] = null;
    }
  }

  rows = rows.filter(Boolean);

  // fallback letters if all empty
  const allEmpty = rows.every((r) => !String(r.letters || "").trim());
  if (allEmpty && wordText) {
    const fb = splitEvenly(wordText, rows.length || 1);
    rows = rows.map((r, idx) => ({ ...r, letters: fb[idx] || "" }));
  }

  // preserve capitalization
  if (wordText && wordText[0] === wordText[0].toUpperCase() && rows.length && rows[0].letters) {
    rows[0] = { ...rows[0], letters: rows[0].letters[0].toUpperCase() + rows[0].letters.slice(1) };
  }

  return rows;
}


export default function PhonemeFeedback({
  result,
  embed = false,
  hideBookmark = false,
  onRetry,
  mode = "full",
  onFocus, // ✅ add back (kun callback)
}) {
  const { settings } = useSettings();
  
    // --- Global volume (0..1) ---
  const effectiveVolume = useMemo(() => {
    // hvis du stadig bruger soundEnabled som master mute:
    if (settings?.soundEnabled === false) return 0;

    const v =
      settings?.volume != null
        ? Number(settings.volume)
        : settings?.soundVolume != null
        ? Number(settings.soundVolume)
        : 0.6;

    if (!Number.isFinite(v)) return 0.6;
    return Math.max(0, Math.min(1, v));
  }, [settings?.volume, settings?.soundVolume, settings?.soundEnabled]);


  // ✅ Dark mode removed (always light)
  const isDark = false;

  // ✅ Light-only iOS-ish palette
  const ui = {
    cardBg: "#FFFFFF",
    cardBorder: "rgba(0,0,0,0.08)",
    cardShadow: "0 10px 30px rgba(0,0,0,0.08)",

    panelBg: "#F2F2F7",
    panelBorder: "rgba(0,0,0,0.08)",

    divider: "rgba(0,0,0,0.08)",

    textStrong: "rgba(17,24,39,0.95)",
    text: "rgba(17,24,39,0.80)",
    textMuted: "rgba(17,24,39,0.55)",
    iconMuted: "rgba(17,24,39,0.28)",
    iconMuted2: "rgba(17,24,39,0.22)",

    btnBg: "#F2F2F7",
    btnBg2: "#F2F2F7",
    btnBorder: "rgba(0,0,0,0.10)",
  };

  // ✅ Hooks MUST be before any early return
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachErr, setCoachErr] = useState("");
  const [coachAudioUrl, setCoachAudioUrl] = useState(null);
  const [coachMap, setCoachMap] = useState(null);

  // ✅ Azure TTS tempo (changes Azure speed, NOT playback speed)
  const COACH_TTS_RATES = [1.0, 0.65, 0.5];
  const [coachTtsIdx, setCoachTtsIdx] = useState(0);
  const coachTtsRate = COACH_TTS_RATES[coachTtsIdx] ?? 1.0;

  function cycleCoachTtsRate() {
    setCoachTtsIdx((i) => (i + 1) % COACH_TTS_RATES.length);
  }

  const [booked, setBooked] = useState(false);
  const [openChunk, setOpenChunk] = useState(null);
  const [openDetail, setOpenDetail] = useState(null); // key = `${row.i}:${id}`
    // ✅ Guided "zoom" on hero word chunks
  const [activeChunkIdx, setActiveChunkIdx] = useState(0);

  useEffect(() => {
    // reset when new result arrives
    setActiveChunkIdx(0);
  }, [result]);


  function prevChunk() {
    if (!chunkRows?.length) return;
    setActiveChunkIdx((i) => Math.max(0, i - 1));
  }

  function nextChunk() {
    if (!chunkRows?.length) return;
    setActiveChunkIdx((i) => Math.min(chunkRows.length - 1, i + 1));
  }


  const [selectedPhKey, setSelectedPhKey] = useState(null);
  const [tipByKey, setTipByKey] = useState(() => ({}));
  const [tipLoadingByKey, setTipLoadingByKey] = useState(() => ({}));
  const [tipErrByKey, setTipErrByKey] = useState(() => ({}));

  async function loadCoachTipForKey(rowKey, payload) {
    if (tipByKey?.[rowKey]) return;

    setTipErrByKey((p) => ({ ...(p || {}), [rowKey]: "" }));
    setTipLoadingByKey((p) => ({ ...(p || {}), [rowKey]: true }));

    try {
      const tip = await getCoachFeedback(payload);
      const tipText = typeof tip === "string" ? tip : (tip?.tip || tip?.text || tip?.message || "").toString();
      setTipByKey((p) => ({ ...(p || {}), [rowKey]: tipText || "No tip available." }));
    } catch (e) {
      setTipErrByKey((p) => ({ ...(p || {}), [rowKey]: e?.message || String(e) }));
    } finally {
      setTipLoadingByKey((p) => ({ ...(p || {}), [rowKey]: false }));
    }
  }

  // ===== Per-row Native speed (NOT global) =====
  const SPEEDS = [1.0, 0.65, 0.5];
  const [rateIdxByKey, setRateIdxByKey] = useState(() => ({}));

  function getRateForKey(key) {
    const idx = rateIdxByKey?.[key];
    return SPEEDS[Number.isFinite(idx) ? idx : 0] ?? 1.0;
  }

  function cycleRateForKey(key) {
    setRateIdxByKey((prev) => {
      const cur = prev?.[key];
      const curIdx = Number.isFinite(cur) ? cur : 0;
      const nextIdx = (curIdx + 1) % SPEEDS.length;
      return { ...(prev || {}), [key]: nextIdx };
    });
  }

  if (!result) return null;
  window.__lastResult = result;

  function getUseGB() {
    const accentRaw = String(result.accent || result.accent_code || result.accentCode || settings.accentDefault || "").toLowerCase();
    return settings.accentDefault === "en_br" || accentRaw.includes("uk") || accentRaw.includes("brit") || accentRaw === "en_br";
  }

  useEffect(() => {
    let cancelled = false;

    async function loadCoach() {
      const text = String((result?.target || result?.reference || result?.text || result?.refText || result?.transcript || "") || "").trim();
      if (!text) return;

      setCoachErr("");
      setCoachLoading(true);

      try {
        const accent = getUseGB() ? "en_br" : "en_us";
        const base = getApiBase();

        const res = await fetch(`${base}/api/align-tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refText: text,
            accent,
            ttsRate: coachTtsRate,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "align-tts failed");

        const mime = json?.mime || "audio/mpeg";
        const b64 = json?.audioBase64 || "";
        const tokens = Array.isArray(json?.tokens) ? json.tokens : [];

        if (!b64 || !tokens.length) throw new Error("No coach audio/tokens returned");

        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        const url = URL.createObjectURL(blob);

        if (cancelled) return;

        setCoachAudioUrl((prev) => {
          try {
            if (prev) URL.revokeObjectURL(prev);
          } catch {}
          return url;
        });

        setCoachMap({ tokens });
      } catch (e) {
        if (!IS_PROD) console.log("align-tts error:", e);
        if (!cancelled) {
          setCoachErr(e?.message || String(e));
          setCoachAudioUrl(null);
          setCoachMap(null);
        }
      } finally {
        if (!cancelled) setCoachLoading(false);
      }
    }

    loadCoach();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, coachTtsRate]);

  const apiErr = result.error || result.errId || (result._debug && (result._debug.error || result._debug.errId));
  if (apiErr) {
    return (
      <div
        className={embed ? "" : "rounded-[22px] p-5"}
        style={{
          background: ui.cardBg,
          border: embed ? "none" : `1px solid ${ui.cardBorder}`,
          boxShadow: embed ? "none" : ui.cardShadow,
        }}
      >
        <div className="text-[17px] font-semibold" style={{ color: ui.text }}>
          Error
        </div>
        <div className="mt-2" style={{ color: "#e5484d" }}>
          {String(apiErr)}
        </div>
      </div>
    );
  }

  const words = Array.isArray(result.words) ? result.words : [];
  const targetSentenceRaw = (result.target || result.reference || result.text || result.refText || "").trim();
  const recognition = (result.recognition ?? result.transcript ?? "").trim();
  const metaRecognition = (result.recognition ?? "").trim();
const metaConfidence = result.confidence ?? null;
const metaWarning = result.warning ?? null;
const metaIntegrity = result.integrity ?? null;
const metaPauseCount = result.pause_count ?? null;
const metaSpeed = result.speed ?? null;
const metaDuration = result.numeric_duration ?? result.duration ?? null;

const metaFiller = result.pause_filler ?? null;
const metaLiaison = result.liaison ?? null;
const metaPlosion = result.plosion ?? null;

  const wordsJoined = Array.isArray(words) ? words.map((w) => (w.word ?? w.w ?? "")).join(" ").trim() : "";
  const displaySentence = targetSentenceRaw || recognition || wordsJoined;

  const isSentence = false;

  const overall01 = to01(result.overall ?? result.pronunciation ?? result.overallAccuracy ?? result.score);

  const oneWord = !isSentence && words.length === 1 ? words[0] : null;
  const apiWordText = (oneWord?.word ?? oneWord?.w ?? "").trim();
  const wordPhs = oneWord ? (Array.isArray(oneWord.phonemes) ? oneWord.phonemes : []) : [];
  const wordPhonics = oneWord ? (Array.isArray(oneWord.phonics) ? oneWord.phonics : []) : [];

  const targetSingleWord = !isSentence && targetSentenceRaw && !/\s/.test(targetSentenceRaw) ? targetSentenceRaw : "";
  const wordText = targetSingleWord || apiWordText;


  // --- Overall score (Model B) for single-word results ---
const modelBOverall = useMemo(() => {
  // Fallback to API overall if not a single word with phonemes
  if (!oneWord || !wordPhs?.length) {
    const overall01 = to01(result.overall ?? result.pronunciation ?? result.overallAccuracy ?? result.score);
    const pct = overall01 != null ? Math.round(overall01 * 100) : null;
    return { pct, missingCount: 0, total: 0 };
  }

  const phonemeScores = wordPhs.map((p) => {
    const s01 = readPhoneme(p)?.s01;
    const pct = typeof s01 === "number" ? Math.round(s01 * 100) : 0;
    return { score: pct };
  });

  const { overall, missingCount, total } = calculateOverallScoreModelB(phonemeScores);
  return { pct: overall, missingCount, total };
}, [result, oneWord, wordPhs]);

  const targetText = oneWord ? wordText || "" : displaySentence || "";
const targetScorePct = modelBOverall.pct;
const hasSpoken =
  Number(targetScorePct) > 0 &&
  Array.isArray(wordPhs) &&
  wordPhs.some(p => (readPhoneme(p)?.s01 ?? 0) > 0);


// --- MAIN overall score bar (XP-style fill + smooth color fade) ---
const [animatedOverallPct, setAnimatedOverallPct] = useState(0);

useEffect(() => {
  if (targetScorePct == null) return;

  const target = Math.max(0, Math.min(100, Number(targetScorePct) || 0));
  const durationMs = 900;

  let raf = null;
  const t0 = performance.now();

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // always start from 0 like a videogame bar
  setAnimatedOverallPct(0);

  const tick = (now) => {
    const p = Math.min(1, (now - t0) / durationMs);
    const eased = easeOutCubic(p);
    const v = 0 + (target - 0) * eased;

    setAnimatedOverallPct(Math.round(v));

    if (p < 1) raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  return () => {
    if (raf) cancelAnimationFrame(raf);
  };
}, [targetScorePct]);

  const lastCelebratedRef = useRef(null);
const [shineKey, setShineKey] = useState(0);

useEffect(() => {
  if (!result) return;
  if (lastCelebratedRef.current === result) return;

  lastCelebratedRef.current = result;

  if ((targetScorePct ?? 0) >= 85) {
    setShineKey((k) => k + 1); // keeps shine replay, no confetti
  }
}, [result, targetScorePct]);



  function onToggleBookmark() {
    if (!targetText) return;
    toggleBookmark({
      text: targetText,
      ipa: "",
      score: targetScorePct,
      type: oneWord ? "word" : "sentence",
      createdAt: Date.now(),
    });
    setBooked(isBookmarked(targetText));
  }

/* audio */
const userAudioUrl =
  result?.userAudioUrl ||
  result?.audioUrl ||
  result?.recordingUrl ||
  result?.audio?.url ||
  result?.userAudio?.url ||
  null;

// Debug (safe)
if (!IS_PROD) console.log("PF userAudioUrl:", userAudioUrl, "effectiveVolume:", effectiveVolume);

const userAudioRef = useRef(null);

useEffect(() => {
  try {
    if (userAudioRef.current) userAudioRef.current.volume = effectiveVolume;
  } catch {}
}, [effectiveVolume]);

async function playRecording() {
  if (!userAudioUrl) return;

  try {
    const el = userAudioRef.current;

    // Prefer <audio> element for stable playback
    if (el) {
      if (el.src !== userAudioUrl) {
        el.src = userAudioUrl;
        el.load();
      }

      el.volume = effectiveVolume;
      el.currentTime = 0;

      const p = el.play();
      if (p?.catch) p.catch(() => {});
      return;
    }

    // Fallback
    const a = new Audio(userAudioUrl);
    a.volume = effectiveVolume;
    a.currentTime = 0;
    window.__pf_last_user_audio = a;

    const p = a.play();
    if (p?.catch) p.catch(() => {});
  } catch (e) {
    console.log("playRecording failed:", e);
  }
}


  // ✅ Plays a segment of YOUR recording, using spans (if available).
  async function playUserSpan(startSec, endSec) {
    if (!userAudioUrl) return;
    if (typeof startSec !== "number" || typeof endSec !== "number" || !(endSec > startSec)) {
      playRecording();
      return;
    }
    try {
            await playAudioSegment(userAudioUrl, startSec, endSec, { volume: effectiveVolume });
    } catch (e1) {
      try {
                await playAudioSegment(userAudioUrl, Math.round(startSec * 1000), Math.round(endSec * 1000), { volume: effectiveVolume });

      } catch {
        playRecording();
      }
    }
  }

  async function playCoachSpan(startSec, endSec, rate = 1.0) {
    if (!coachAudioUrl || !coachMap?.tokens?.length) return;
    if (typeof startSec !== "number" || typeof endSec !== "number" || !(endSec > startSec)) return;

    try {
            await playAudioSegment(coachAudioUrl, startSec, endSec, { rate, volume: effectiveVolume });

    } catch (e1) {
      try {
                await playAudioSegment(coachAudioUrl, Math.round(startSec * 1000), Math.round(endSec * 1000), { rate, volume: effectiveVolume });

      } catch {}
    }
  }

    async function playCoachFull(rate = 1.0) {
    if (!coachAudioUrl) return;
    try {
      await playAudioSegment(coachAudioUrl, 0, 60 * 60, { rate, volume: effectiveVolume });
    } catch {
      try {
        const a = new Audio(coachAudioUrl);
        a.volume = effectiveVolume; // ✅ ADD
        a.playbackRate = rate;
        const p = a.play();
        if (p?.catch) p.catch(() => {});
      } catch {}
    }
  }


  const nativeReady = !!coachAudioUrl && !!coachMap?.tokens?.length && !coachLoading;

  // ✅ Build CMU tokens + scores + chunks + lettersByIdx + chunkScores (+ spans)
  const cmuData = useMemo(() => {
    if (!oneWord || !wordPhs.length) {
      return { chunks: [], lettersByIdx: [], scoresByIdx: [], cmuTokens: [], chunkScores: [], spansByIdx: [] };
    }

    const meta = wordPhs.map((p) => readPhoneme(p));
    const cmuTokens = meta.map((m) => toCMU(m.sym)).filter(Boolean);
    const scoresByIdx = meta.map((m) => (typeof m.s01 === "number" ? m.s01 : 0));
    const weightsByIdx = meta.map((m) => (typeof m.dur === "number" ? m.dur : 1));
    const spansByIdx = meta.map((m) => ({ startSec: m.startSec, endSec: m.endSec }));

    const lettersByIdx = buildLettersByIdxFromPhonics(wordPhonics, cmuTokens);
    const chunks = chunkCmuIndexesSmart(cmuTokens);

    const chunkScores = chunks.map((idxs) => {
      let num = 0;
      let den = 0;
      for (const ix of idxs) {
        const s = typeof scoresByIdx[ix] === "number" ? scoresByIdx[ix] : 0;
        const w = typeof weightsByIdx[ix] === "number" ? weightsByIdx[ix] : 1;
        num += s * w;
        den += w;
      }
      return den > 0 ? num / den : 0;
    });

    // coach spans by index (best effort 1:1)
    const coachTokens = Array.isArray(coachMap?.tokens) ? coachMap.tokens : [];
    const coachSpansByIdx = cmuTokens.map((_, i) => {
      const t = coachTokens[i];
      const s = typeof t?.start === "number" ? t.start : null;
      const e = typeof t?.end === "number" ? t.end : null;
      return { startSec: s, endSec: e };
    });

    return { chunks, lettersByIdx, scoresByIdx, cmuTokens, chunkScores, spansByIdx, coachSpansByIdx };
  }, [oneWord, wordPhs, wordPhonics, coachMap]);

  const chunkRows = useMemo(() => {
    if (!oneWord) return [];

    const chunks = cmuData.chunks || [];
    const lettersByIdx = cmuData.lettersByIdx || [];
    const scoresByIdx = cmuData.scoresByIdx || [];
    const cmuTokens = cmuData.cmuTokens || [];

    const spansByIdx = cmuData.spansByIdx || []; // USER spans
    const coachSpansByIdx = cmuData.coachSpansByIdx || []; // COACH spans

    // 1) build rows
    let rows = chunks.map((idxs, i) => {
      const letters = idxs.map((ix) => String(lettersByIdx[ix] || "")).join("");
      const pct = Math.round((cmuData.chunkScores?.[i] ?? 0) * 100);

      // USER chunk span
      let minS = null;
      let maxE = null;
      for (const ix of idxs) {
        const s = spansByIdx[ix]?.startSec;
        const e = spansByIdx[ix]?.endSec;
        if (typeof s === "number" && typeof e === "number" && e > s) {
          if (minS == null || s < minS) minS = s;
          if (maxE == null || e > maxE) maxE = e;
        }
      }

      // COACH chunk span
      let cMinS = null;
      let cMaxE = null;
      for (const ix of idxs) {
        const s = coachSpansByIdx[ix]?.startSec;
        const e = coachSpansByIdx[ix]?.endSec;
        if (typeof s === "number" && typeof e === "number" && e > s) {
          if (cMinS == null || s < cMinS) cMinS = s;
          if (cMaxE == null || e > cMaxE) cMaxE = e;
        }
      }

      const phonemes = idxs.map((ix) => {
        const s01 = scoresByIdx[ix] ?? 0;
        const span = spansByIdx[ix] || {};
        const cspan = coachSpansByIdx[ix] || {};

        return {
          ix,
          cmu: cmuTokens[ix],
          pretty: cmuPrettyToken(cmuTokens[ix]),
          pct: Math.round((s01 ?? 0) * 100),
          s01,

          // user spans
          startSec: span.startSec ?? null,
          endSec: span.endSec ?? null,

          // coach spans
          coachStartSec: cspan.startSec ?? null,
          coachEndSec: cspan.endSec ?? null,
        };
      });

      return {
        i,
        idxs,
        letters,
        pct,
        phonemes,

        // user
        startSec: minS,
        endSec: maxE,

        // coach
        coachStartSec: cMinS,
        coachEndSec: cMaxE,
      };
    });

    // 2) merge: if a row has empty letters, move its phonemes into previous row with letters
    for (let i = 0; i < rows.length; i++) {
      const letters = String(rows[i]?.letters || "").trim();
      if (letters) continue;

      let j = i - 1;
      while (j >= 0 && !String(rows[j]?.letters || "").trim()) j--;

      if (j >= 0) {
        const a = rows[j];
        const b = rows[i];

        rows[j] = {
          ...a,
          idxs: [...(a.idxs || []), ...(b.idxs || [])],
          phonemes: [...(a.phonemes || []), ...(b.phonemes || [])],

          // merge spans (user)
          startSec: a.startSec != null ? a.startSec : b.startSec,
          endSec:
            Math.max(a.endSec ?? -Infinity, b.endSec ?? -Infinity) > -Infinity
              ? Math.max(a.endSec ?? -Infinity, b.endSec ?? -Infinity)
              : null,

          // merge spans (coach)
          coachStartSec: a.coachStartSec != null ? a.coachStartSec : b.coachStartSec,
          coachEndSec:
            Math.max(a.coachEndSec ?? -Infinity, b.coachEndSec ?? -Infinity) > -Infinity
              ? Math.max(a.coachEndSec ?? -Infinity, b.coachEndSec ?? -Infinity)
              : null,

          // simple weighted score by phoneme count
          pct: Math.round(
            ((a.pct ?? 0) * ((a.phonemes || []).length || 1) + (b.pct ?? 0) * ((b.phonemes || []).length || 1)) /
              (((a.phonemes || []).length || 1) + ((b.phonemes || []).length || 1))
          ),
        };

        rows[i] = null;
      }
    }

    // 3) remove null rows
    rows = rows.filter(Boolean);

    // 4) fallback letters if all empty
    const allEmpty = rows.every((r) => !String(r.letters || "").trim());
    if (allEmpty && wordText) {
      const fb = splitEvenly(wordText, rows.length || 1);
      rows = rows.map((r, idx) => ({ ...r, letters: fb[idx] || "" }));
    }

    // 5) preserve capitalization
    if (wordText && wordText[0] === wordText[0].toUpperCase() && rows.length && rows[0].letters) {
      rows[0] = { ...rows[0], letters: rows[0].letters[0].toUpperCase() + rows[0].letters.slice(1) };
    }

    return rows;
  }, [oneWord, cmuData, wordText]);
  

const heroWordSpan = useMemo(() => {
  if (!chunkRows?.length) return null;

  let start = null;
  let end = null;

  for (const r of chunkRows) {
    if (typeof r?.startSec === "number" && typeof r?.endSec === "number" && r.endSec > r.startSec) {
      start = start == null ? r.startSec : Math.min(start, r.startSec);
      end = end == null ? r.endSec : Math.max(end, r.endSec);
    }
  }

  if (start == null || end == null || !(end > start)) return null;
  return { startSec: start, endSec: end };
}, [chunkRows]);

function fireFocus(idx = 0) {
  if (!onFocus) return;
  if (!chunkRows?.length) return;

  const safeIdx = Math.max(0, Math.min(idx, chunkRows.length - 1));
  setActiveChunkIdx(safeIdx);

  // ✅ send selected index too
  onFocus({ chunkRows, wordText, activeChunkIdx: safeIdx });
}

// ✅ Auto-open / auto-update focus mode (no click)
useEffect(() => {
  if (!onFocus) return;
  if (!chunkRows?.length) return;

  // Always keep overlay in sync with current active chunk
  onFocus({ chunkRows, wordText, activeChunkIdx });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [onFocus, wordText, chunkRows, activeChunkIdx]);


function WordOnly() {
  return (
   <div
  className="pf-hero-word"
  style={{
    color: ui.textStrong,
    display: "inline-flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 0,
  }}
>
  {chunkRows?.length
    ? chunkRows.map((row, idx) => {
        const isActive = idx === activeChunkIdx;

        return (
          <span
            key={`wseg-${row.i}`}
            onClick={() => setActiveChunkIdx(idx)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveChunkIdx(idx);
              }
            }}
            style={{
              color: scoreToColor01((row.pct ?? 0) / 100),

              // ✅ the actual "zoom / focus" effect:
              transform: isActive ? "scale(1.18)" : "scale(1.0)",
              opacity: isActive ? 1 : 0.25,
              filter: isActive ? "none" : "blur(0px)",

              transformOrigin: "50% 60%",
              transition: "transform 220ms ease, opacity 220ms ease",
              cursor: "pointer",

              // makes it feel like you're focusing a segment
              padding: "0 1px",
            }}
          >
            {row.letters}
          </span>
        );
      })
    : wordText}
</div>

  );
}



  if (mode === "wordOnly") {
  return <WordOnly />;
}

  return (
    <div
  className={embed ? "" : "rounded-[22px] relative"}
  style={{
    background: embed ? "transparent" : ui.cardBg,
    border: embed ? "none" : `1px solid ${ui.cardBorder}`,
    boxShadow: embed ? "none" : ui.cardShadow,

    
  }}
>
      <audio ref={userAudioRef} playsInline preload="auto" />

      {!hideBookmark && (
        <div className={embed ? "" : "px-5 pt-5"}>
          <div className="flex items-start justify-end">
            {targetScorePct != null && targetText && (
              <button
                type="button"
                onClick={onToggleBookmark}
                className="grid place-items-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: ui.btnBg,
                  border: `1px solid ${ui.btnBorder}`,
                  color: ui.text,
                }}
                title={booked ? "Remove bookmark" : "Bookmark"}
              >
                {booked ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      )}

            <div className={embed ? "" : "px-5 pb-6"}>
        {oneWord && (
          <div className="mt-0">
            {/* ONE shared width wrapper for BOTH cards */}
            <div style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
              {/* HERO CARD */}
            <motion.div
  layoutId="pf-hero-card"
  key={shineKey}
  className={`pf-surface pf-hero-card ${(targetScorePct ?? 0) >= 85 ? "pf-hero-shine" : ""}`}
  style={{ width: "100%" }}
>
                <div className="pf-hero-word" style={{ color: ui.textStrong }}>
  {chunkRows?.length
    ? chunkRows.map((row, idx) => (
        <span
          key={`wseg-${row.i}`}
          style={{
            color: scoreToColor01((row.pct ?? 0) / 100),
            transform: "scale(1)",
opacity: 1,
transition: "none",
          }}
        >
          {row.letters}
        </span>
      ))
    : wordText}
</div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    className="pf-pill"
                    onClick={() => {
                      if (!nativeReady) return;
                      playCoachFull(1.0);
                    }}
                    disabled={!nativeReady}
                    title={nativeReady ? "Play coach" : "Coach not ready yet"}
                  >
                    <Volume2 className="h-4 w-4" />
                    Coach
                  </button>

                  <button
                    type="button"
                    className="pf-pill"
onClick={async () => {
  if (!userAudioUrl) return;

  // 1) cut via chunkRows span (samme spans som virker for chunks)
  if (heroWordSpan) {
    await playUserSpan(heroWordSpan.startSec, heroWordSpan.endSec);
    return;
  }

  // 2) fallback: prøv SpeechSuper word span helper
  const ok = await playTrimmedUserWord(result, 0, { volume: effectiveVolume });
  if (ok) return;

  // 3) fallback: full
  playRecording();
}}


                    disabled={!userAudioUrl}
                    title={userAudioUrl ? "Play your recording" : "No recording available"}
                  >
                    <Volume2 className="h-4 w-4" />
                    You
                  </button>
                </div>
{/* Main overall score bar (under Coach/You) */}
{targetScorePct != null && (
  <div style={{ marginTop: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: ui.textMuted }}>
        Overall score
      </div>
      <div style={{ fontSize: 12, fontWeight: 900, color: ui.text }}>
        {animatedOverallPct}%
      </div>
    </div>

    <div
      style={{
        marginTop: 8,
        height: 12,
        borderRadius: 999,
        background: "rgba(0,0,0,0.10)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${animatedOverallPct}%`,
          borderRadius: 999,
          background: scoreToColor01(animatedOverallPct / 100), // ✅ smooth fade (78% ~ greenish)
          transition: "width 60ms linear",
        }}
      />
    </div>
  </div>
)}

                {!!coachErr && !IS_PROD && (
  <div className="mt-3" style={{ color: "#e5484d", fontSize: 13 }}>
    Coach: {coachErr}
  </div>
)}

</motion.div>

              {/* CHUNK LIST (same width as hero) */}
{mode === "full" && chunkRows.length > 0 && (
                <div className="pf-list" style={{ width: "100%" }}>
                  {chunkRows.map((row) => {
                    const isOpen = openChunk === row.i;
                    const badgePct = Math.max(0, Math.min(100, Number(row.pct) || 0));

                    return (
                      <div
                        key={`chunkcard-${row.i}`}
                        className="pf-row-card"
                        style={{ width: "100%" }}
                        onClick={() => setOpenChunk((v) => (v === row.i ? null : row.i))}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpenChunk((v) => (v === row.i ? null : row.i));
                          }
                        }}
                      >
                        <div className="pf-row-top">
                          <div className="pf-row-title">{row.letters || "—"}</div>
                        </div>

                        <div className="pf-row-sub">
                          <div className="pf-seg">
                            <button
                              type="button"
                              className="pf-seg-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                cycleCoachTtsRate();
                              }}
                              title="Change Native tempo (Azure TTS)"
                            >
                              {coachTtsRate.toFixed(2)}
                            </button>

                            <button
                              type="button"
                              className="pf-seg-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!nativeReady) return;
                                playCoachSpan(row.coachStartSec, row.coachEndSec, 1.0);
                              }}
                              disabled={!nativeReady}
                              title={nativeReady ? "Play native (this part)" : "Native not ready yet"}
                            >
                              <Volume2 className="h-4 w-4" />
                              Native
                            </button>
                          </div>

                          <div className="pf-row-right">
                            <button
                              type="button"
                            className="pf-pill pf-you-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                playUserSpan(row.startSec, row.endSec);
                              }}
                              title="Play your recording (this part)"
                            >
                              <Volume2 className="h-4 w-4" />
                              You
                            </button>

                            <div className="pf-row-actions">
                              <ProgressRing pct={badgePct} />

                             <button
  type="button"
  className="pf-chevron"
  onClick={(e) => {
    e.stopPropagation();
    setOpenChunk((v) => (v === row.i ? null : row.i));
  }}
  aria-label="Toggle details"
  style={{
    width: 36,
    height: 36,
    flex: "0 0 36px",
    display: "grid",
    placeItems: "center",
    padding: 0,
  }}
>
  <ChevronRight
    className="h-5 w-5"
    style={{
      transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
      transformOrigin: "50% 50%",
      transition: "transform 160ms ease",
      display: "block",
    }}
  />
</button>

                            </div>
                          </div>
                        </div>

                      {isOpen && (
  <div style={{ marginTop: 10 }}>

    {/* PHONEMES (existing) */}
    <div className="phoneme-row">
      {row.phonemes.map((ph) => (
        <button
          key={`${row.i}-ph-${ph.ix}`}
          type="button"
          className="phoneme-chip"
          onClick={(e) => {
            e.stopPropagation();
            playUserSpan(ph.startSec, ph.endSec);
          }}
          title={`${ph.cmu} • ${ph.pct}%`}
          style={{
            borderColor: "rgba(0,0,0,0.12)",
            color: scoreToColor01((ph.pct ?? 0) / 100),
          }}
        >
          <span style={{ fontWeight: 900 }}>{cmuChipLabel(ph.cmu)}</span>
          <span style={{ opacity: 0.75, fontWeight: 800 }}>{ph.pct}%</span>
        </button>
      ))}
    </div>
  </div>
)}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}