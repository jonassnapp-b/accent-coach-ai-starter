/**
 * Progressive Sentence Mastery — Everyday Spoken English
 * - Infinite content (deterministic)
 * - Natural, usable everyday spoken English
 * - Difficulty = pronunciation challenges (not fancy vocab)
 *
 * Fixes:
 * - No more "this this ..." (objects are now bare nouns)
 * - No more ungrammatical "you're wanna ..."
 * - Levels actually change: length + template mix + spoken reductions/linking/fillers
 */

const STORAGE_KEY = "ac_psm_v3";

const SESSION_SEED_KEY = "ac_psm_session_seed_v1";

function getSessionSeed() {
  // ✅ Works in browser AND in Node (build scripts)
  try {
    if (typeof localStorage !== "undefined") {
      return String(localStorage.getItem(SESSION_SEED_KEY) || "0");
    }
  } catch {}
  // Node fallback: allow deterministic build seed via env, else "0"
  try {
    if (typeof process !== "undefined" && process?.env?.AC_PSM_SEED) {
      return String(process.env.AC_PSM_SEED);
    }
  } catch {}
  return "0";
}


/* ---------------- Difficulty ladder (5 levels) ---------------- */
export const LEVELS = [
  // short + super clean
  { id: "l01", passAllGreenPct: 85, targetLen: [3, 7], mix: ["basic"] },

  // slightly longer + rhythm/stress cues
  { id: "l02", passAllGreenPct: 86, targetLen: [5, 10], mix: ["basic", "rhythm"] },

  // reductions + linking (everyday fast speech)
  { id: "l03", passAllGreenPct: 87, targetLen: [7, 14], mix: ["reduction", "linking"] },

  // stress shift / contrast / emphasis
  { id: "l04", passAllGreenPct: 88, targetLen: [9, 18], mix: ["stress_shift", "linking"] },

  // fastest speech + natural fillers + longer sentences
  { id: "l05", passAllGreenPct: 90, targetLen: [12, 26], mix: ["fast_speech", "natural_fillers"] },
];

/* ---------------- Spoken vocab pools ---------------- */
const V = {
  subj: ["I", "We", "You", "They"],

  verbs_easy: ["want", "need", "like", "hate", "remember", "forget", "say", "hear"],
  verbs_mid: ["try", "start", "stop", "sound", "feel", "notice", "repeat"],
  // spoken helpers (use only in templates designed for them)
  wannaVerbs: ["say it", "sound natural", "say this word", "say it fast", "say it clearly"],
  gonnaPhrases: ["do it again", "slow it down", "speed it up", "fix the ending", "relax my mouth"],
  gottaPhrases: ["focus on the vowel", "hit the ending", "link the words", "stress the right part"],

  noun: ["sound", "word", "sentence", "vowel", "ending", "part", "stress"],
  determiner: ["this", "that", "the"],

  time: ["today", "right now", "these days"],
  fillers: ["I mean", "honestly", "like", "you know", "to be fair"],
  connectors: ["and", "but", "so"],

  reasons: [
    "it feels rushed",
    "it sounds off",
    "my mouth feels tight",
    "I tense up",
    "it comes out messy",
    "I lose the ending",
  ],
};

/* ---------------- Templates (spoken, grammatical) ---------------- */
const TEMPLATES = {
  // clean + simple
  basic: [
    "{S} {VE} {DET} {N}.",
    "{S} {VE} {DET} {N} again.",
    "{S} {VE} how {DET} {N} sounds.",
    "{S} {VE} {DET} {N} part.",
  ],

  // rhythm + stress timing
  rhythm: [
    "{S} {VM} {DET} {N}, but the timing feels weird.",
    "{S} {VM} it slower {T}.",
    "{S} {VM} the stress on the right part.",
    "{S} {VM} to keep the rhythm steady.",
  ],

  // reduction: softening, less force, relaxed mouth
  reduction: [
    "{S} {VM} {DET} {N}, but it comes out too strong.",
    "{S} {VM} to relax a bit.",
    "{S} {VM} it kind of fast, and {R}.",
    "{S} {VM} to keep it light, not heavy.",
  ],

  // linking: connecting words, smooth transitions
  linking: [
    "{S} {VM} {DET} {N}, and the words blend together.",
    "{S} {VM} it again, but connect the words.",
    "{S} {VM} to link it smoothly so it flows.",
    "{S} {VM} it fast, but keep it clear.",
  ],

  // stress shift: emphasis contrast
  stress_shift: [
    "{S} {VM} {DET} {N}, but the stress moves.",
    "{S} {VM} the wrong part, and it changes the meaning.",
    "{S} {VM} to stress this instead, not that.",
    "{S} {VM} to keep the emphasis in the right place.",
  ],

  // fast speech: longer + still everyday
  fast_speech: [
    "{S} {VM} it fast, {C} {R}.",
    "{S} {VM} {DET} {N} quickly, but I lose the ending.",
    "{S} {VM} it without thinking, and it sounds different.",
    "{S} {VM} to keep it smooth even when it's fast.",
    // spoken contractions without broken grammar
    "I wanna {W}.",
    "I'm gonna {G}.",
    "I've gotta {GT}.",
  ],

  // natural fillers: realistic conversational lines
  natural_fillers: [
    "{F}, I wanna {W}.",
    "{F}, I'm gonna {G}.",
    "{F}, I've gotta {GT}.",
    "{F}, {S} {VM} {DET} {N}, but {R}.",
    "{F}, {S} {VM} it {T}, {C} it still sounds off.",
  ],
};

/* ---------------- RNG (deterministic) ---------------- */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function sfc32(a, b, c, d) {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function rngFor(key) {
  const seed = xmur3(key);
  return sfc32(seed(), seed(), seed(), seed());
}
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function wc(s) {
  return String(s).trim().split(/\s+/).filter(Boolean).length;
}

/* ---------------- Fill template ---------------- */
function fill(rng, tpl) {
  const S = pick(rng, V.subj);
  const VE = pick(rng, V.verbs_easy);
  const VM = pick(rng, [...V.verbs_easy, ...V.verbs_mid]);

  const DET = pick(rng, V.determiner);
  const N = pick(rng, V.noun);

  const T = pick(rng, V.time);
  const F = pick(rng, V.fillers);
  const C = pick(rng, V.connectors);
  const R = pick(rng, V.reasons);

  const W = pick(rng, V.wannaVerbs);
  const G = pick(rng, V.gonnaPhrases);
  const GT = pick(rng, V.gottaPhrases);

  return tpl
    .replaceAll("{S}", S)
    .replaceAll("{VE}", VE)
    .replaceAll("{VM}", VM)
    .replaceAll("{DET}", DET)
    .replaceAll("{N}", N)
    .replaceAll("{T}", T)
    .replaceAll("{F}", F)
    .replaceAll("{C}", C)
    .replaceAll("{R}", R)
    .replaceAll("{W}", W)
    .replaceAll("{G}", G)
    .replaceAll("{GT}", GT);
}

/* ---------------- Persistence ---------------- */
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}
function saveState(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

function initState() {
  return {
    byLevel: Object.fromEntries(LEVELS.map((l) => [l.id, { i: 0 }])),
    activeLevelId: LEVELS[0].id,
  };
}

function ensureState(state) {
  const s = state && typeof state === "object" ? state : initState();

  if (!s.byLevel || typeof s.byLevel !== "object") s.byLevel = {};
  for (const lvl of LEVELS) {
    if (!s.byLevel[lvl.id]) s.byLevel[lvl.id] = { i: 0 };
    if (!Number.isFinite(s.byLevel[lvl.id].i)) s.byLevel[lvl.id].i = 0;
  }

  if (!s.activeLevelId) s.activeLevelId = LEVELS[0].id;
  if (!LEVELS.some((l) => l.id === s.activeLevelId)) s.activeLevelId = LEVELS[0].id;

  return s;
}

function normalizeLevelId(levelId) {
  return LEVELS.some((l) => l.id === levelId) ? levelId : LEVELS[0].id;
}

/* ---------------- Public API ---------------- */
export function getLevelConfig(levelId) {
  return LEVELS.find((l) => l.id === levelId) || LEVELS[0];
}

export function setLevel(levelId) {
  const state = ensureState(loadState());
  state.activeLevelId = normalizeLevelId(levelId);
  saveState(state);
}

export function getLevel() {
  const state = ensureState(loadState());
  return state.activeLevelId || LEVELS[0].id;
}

export function getNextSentence(levelId) {
  const state = ensureState(loadState());
  const id = normalizeLevelId(levelId);

  const slot = state.byLevel[id];
  const lvl = getLevelConfig(id);

  const sessionSeed = getSessionSeed();
const rng = rngFor(`${id}|${slot.i}|psm_v3|${sessionSeed}`);

  for (let t = 0; t < 12; t++) {
    const group = pick(rng, lvl.mix);
    const tpl = pick(rng, TEMPLATES[group] || TEMPLATES.basic);
    const s = fill(rng, tpl);

    const [minW, maxW] = lvl.targetLen;
    const words = wc(s);

    // quick sanity filters (avoid weird accidental doubles)
    if (/\bthis\s+this\b/i.test(s)) continue;
    if (/\byou're\s+wanna\b/i.test(s)) continue;

    if (words >= minW && words <= maxW) {
      saveState(state);
      return s;
    }
  }

  const fallback = fill(rng, pick(rng, TEMPLATES.basic));
  saveState(state);
  return fallback;
}

export function advanceSentence(levelId) {
  const state = ensureState(loadState());
  const id = normalizeLevelId(levelId);
  state.byLevel[id].i += 1;
  saveState(state);
}

export function backSentence(levelId) {
  const state = ensureState(loadState());
  const id = normalizeLevelId(levelId);
  state.byLevel[id].i = Math.max(0, state.byLevel[id].i - 1);
  saveState(state);
}

export function resetLevel(levelId) {
  const state = ensureState(loadState());
  const id = normalizeLevelId(levelId);
  state.byLevel[id].i = 0;
  saveState(state);
}
// --- Coverage bank: ensures we hit rare CMU phonemes in the build index ---
// NOTE: These are normal words/sentences that cover uncommon phonemes like ZH, NG, OY, AW, etc.
const COVERAGE_SENTENCES = [
  // ZH (/ʒ/)
  "I usually watch television in the evening.",
  "That decision was a measure of pleasure.",

  // NG
  "I am singing and bringing something.",
  "We were thinking about going long.",

  // OY
  "The boy enjoyed a noisy toy.",
  "I try to avoid annoying noise.",

  // AW
  "Now I found out how it works.",
  "A loud crowd was outside.",

  // CH / SH / JH
  "Choose a cheap chair and check it.",
  "She should share the shiny shoes.",
  "He jumped onto the job quickly.",

  // TH / DH
  "Think about that thing again.",
  "These are the days that matter.",

  // R / L (clusters too)
  "Please relax and roll your tongue.",
  "The strong string was really long.",

  // AX / schwa-heavy function words
  "I want to go to the store for a moment.",
  "It is a bit of a problem for today.",

  // UH / UW
  "Put the book on the table.",
  "We use two new tools.",

  // AE / EH / IH / IY
  "That cat sat on the mat.",
  "Get the best level next.",
  "This is a simple little fix.",
  "We need to see the key details.",

  // AA / AO (varies by dialect but still useful)
  "The hot coffee was gone.",
  "I saw the small ball fall.",

  // ER
  "Her first turn was perfect.",
];

// --- For build-time phoneme indexing ---
// --- For build-time phoneme indexing (deterministic corpus) ---
// --- For build-time phoneme indexing (deterministic corpus) ---
export function getAllSentences({ perLevel = 1200 } = {}) {
  // ✅ Generates a stable set of sentences per level by iterating indices.
  // ✅ No localStorage mutation.
  // ✅ Always includes COVERAGE_SENTENCES to guarantee rare phoneme coverage.

  // In Node (build), AC_PSM_SEED can be set; otherwise "0"
  const sessionSeed = getSessionSeed();
  const out = [];

  // 0) Always include coverage bank first
  out.push(...COVERAGE_SENTENCES);

  // 1) Generate deterministic template sentences
  for (const lvl of LEVELS) {
    const id = lvl.id;

    for (let i = 0; i < perLevel; i++) {
      const rng = rngFor(`${id}|${i}|psm_v3|${sessionSeed}`);

      let pickedSentence = null;

      for (let t = 0; t < 12; t++) {
        const group = pick(rng, lvl.mix);
        const tpl = pick(rng, TEMPLATES[group] || TEMPLATES.basic);
        const s = fill(rng, tpl);

        const [minW, maxW] = lvl.targetLen;
        const words = wc(s);

        if (/\bthis\s+this\b/i.test(s)) continue;
        if (/\byou're\s+wanna\b/i.test(s)) continue;

        if (words >= minW && words <= maxW) {
          pickedSentence = s;
          break;
        }
      }

      if (!pickedSentence) {
        pickedSentence = fill(rng, pick(rng, TEMPLATES.basic));
      }

      out.push(pickedSentence);
    }
  }

  // 2) Deduplicate while preserving order
  const seen = new Set();
  const deduped = [];
  for (const s of out) {
    const k = String(s).trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(k);
  }

  return deduped;
}

