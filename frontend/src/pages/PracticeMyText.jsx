 // src/pages/PracticeMyText.jsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ChevronDown, Volume2, Play, Pause, X, RotateCcw } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import * as sfx from "../lib/sfx.js";
import PhonemeFeedback, { pfColorForPct } from "../components/PhonemeFeedback.jsx";



const IS_PROD = !!import.meta?.env?.PROD;
const RETRY_INTENT_KEY = "ac_my_text_retry_intent_v1";
const TROPHY_REACHED_PCT = 95; // justér hvis du vil gøre den hårdere/lettere
const TROPHY_REACHED_KEY = "ac_my_text_trophy_reached_v1";

function hasTrophyCelebrated() {
  try {
    return localStorage.getItem(TROPHY_REACHED_KEY) === "1";
  } catch {
    return false;
  }
}

function markTrophyCelebrated() {
  try {
    localStorage.setItem(TROPHY_REACHED_KEY, "1");
  } catch {}
}


/* ------------ API base (web + native) ------------ */
function isNative() {
  return !!(window?.Capacitor && window.Capacitor.isNativePlatform);
}
function getApiBase() {
  const ls = (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) || "";
  const env = (import.meta?.env && import.meta.env.VITE_API_BASE) || "";
  if (isNative()) {
    const base = (ls || env).replace(/\/+$/, "");
    if (!base) throw new Error("VITE_API_BASE (or localStorage.apiBase) is not set — required on iOS.");
    return base;
  }
  return (ls || env || window.location.origin).replace(/\/+$/, "");
}

function clamp01(v) {
  const n = Number(v);
  if (!isFinite(n)) return null;
  return n <= 1 ? Math.max(0, Math.min(1, n)) : Math.max(0, Math.min(1, n / 100));
}

// PSM-style: duration-weighted phoneme score -> word score (0-100)
function wordScore100LikePSM(wordObj) {
  const phsRaw =
    (Array.isArray(wordObj?.phonemes) && wordObj.phonemes) ||
    (Array.isArray(wordObj?.phoneme) && wordObj.phoneme) ||
    (Array.isArray(wordObj?.phones) && wordObj.phones) ||
    [];

  if (!phsRaw.length) return null;

  let num = 0;
  let den = 0;

  for (const ph of phsRaw) {
    const s01 = clamp01(
      ph.pronunciation ??
        ph.accuracy_score ??
        ph.pronunciation_score ??
        ph.score ??
        ph.accuracy ??
        ph.accuracyScore ??
        ph.overallAccuracy
    );
    if (s01 == null) continue;

    const span = ph.span || ph.time || ph.times || null;
    const start10 = span?.start ?? span?.s ?? span?.begin ?? null;
    const end10 = span?.end ?? span?.e ?? span?.finish ?? null;

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
  const apiWords =
    (Array.isArray(json?.words) && json.words) ||
    (Array.isArray(json?.result?.words) && json.result.words) ||
    (Array.isArray(json?.data?.words) && json.data.words) ||
    [];

  const wordScores = apiWords
    .map((w) => wordScore100LikePSM(w))
    .filter((v) => Number.isFinite(v));

  const overall = wordScores.length
    ? Math.round(wordScores.reduce((a, b) => a + b, 0) / wordScores.length)
    : 0;

  return { overall, wordScores };
}


function sanitizeTextForSubmit(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim();
}
function sanitizeTextForPaste(raw) {
  return String(raw || "").replace(/\s+/g, " ");
}

function pickFeedback(json) {
  const overall = Number(json?.overall ?? json?.pronunciation ?? json?.overallAccuracy ?? 0);
  if (overall >= 95)
    return ["Unreal! 🔥", "Insane clarity! 🌟", "Flawless! 👑", "You’re on fire! 🚀"][Math.floor(Math.random() * 4)];
  if (overall >= 90)
    return ["Awesome work! 💪", "Super clean! ✨", "You nailed it! ✅", "Crisp & clear! 🎯"][Math.floor(Math.random() * 4)];
  if (overall >= 75)
    return ["Great progress — keep going! 🙌", "Nice! Try slightly slower. ⏱️", "Solid! Listen once more, then record. 👂"][
      Math.floor(Math.random() * 3)
    ];
  return ["Good start — emphasize the stressed syllable. 🔊", "Try again a bit slower. 🐢", "Listen once more, then record. 👂"][
    Math.floor(Math.random() * 3)
  ];
}
function heroColorForPct(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return "rgba(255,255,255,0.92)";

  // ✅ Hard thresholds (så 63% aldrig bliver grøn)
  if (n >= 85) return "#22c55e";  // green
  if (n >= 75) return "#eab308";  // yellow
  return "#ef4444";               // red
}

/* ---------------- Coach-like feedback helpers ---------------- */

function getScore(obj) {
  const v =
    obj?.accuracyScore ??
    obj?.overallAccuracy ??
    obj?.accuracy ??
    obj?.pronunciation ??
    obj?.score ??
    obj?.overall ??
    obj?.pronunciationAccuracy ??
    obj?.accuracy_score;

  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}


function isGreen(score) {
  return score != null && score >= 85;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function computeHeroFontSize(text, maxPx, minPx) {
  const t = String(text || "").trim();
  if (!t) return maxPx;

  // Rough fit: longer text => smaller font
  const len = t.length;

  // Tuning:
  // <= 14 chars: keep max
  // 40 chars: noticeably smaller
  // 80+ chars: near min
  const shrink = Math.max(0, len - 14) * 1.05;
  return clamp(Math.round(maxPx - shrink), minPx, maxPx);
}
function computePctFontSize(text, maxPx, minPx) {
  const t = String(text || "").trim();
  if (!t) return maxPx;

  // længere sætning => lidt mindre procent-tal
  const len = t.length;
  const shrink = Math.max(0, len - 18) * 0.45; // tuning
  return clamp(Math.round(maxPx - shrink), minPx, maxPx);
}

function twoLineClampStyle() {
  return {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
    wordBreak: "break-word",
  };
}

function getPhonemeCode(p) {
  return String(p?.phoneme || p?.ipa || p?.symbol || "").trim().toUpperCase();
}

function normalizePhonemeScore(phonemeScore, wordScore, allPhonemeScores) {
  if (phonemeScore == null || wordScore == null) return phonemeScore;
  const scores = (allPhonemeScores || []).filter((x) => Number.isFinite(x));
  if (!scores.length) return phonemeScore;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const shift = wordScore - mean;
  return clamp(phonemeScore + shift, 0, 100);
}

function normalizeWordsFromResult(result, fallbackText) {
  const arr = Array.isArray(result?.words) ? result.words : null;
  if (arr?.length) return arr;

  const text = String(fallbackText || "").trim();
  if (!text) return [];
  const parts = text.split(/\s+/g).filter(Boolean);
  return parts.map((w) => ({ word: w, phonemes: [] }));
}

const IMAGE_ONLY_PHONEMES = new Set(["AA", "AO", "AX", "EY", "IX", "OH", "OW", "UW"]);

function resolvePhonemeMedia(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;

  if (IMAGE_ONLY_PHONEMES.has(c)) {
    return { kind: "image", src: `/phonemes/Videos/${c}.jpg` };
  }
  return { kind: "video", src: `/phonemes/Videos/${c}.mp4` };
}


function getPhonemeLetters(p) {
  // SpeechSuper kan (nogle gange) have et felt for hvilke bogstaver/chunk phonemen matcher.
  // Vi prøver de mest sandsynlige keys. Fallback = tom string.
  const v =
    p?.letters ??
    p?.grapheme ??
    p?.graphemes ??
    p?.text ??
    p?.chunk ??
    p?.segment ??
    p?.display ??
    "";
  return String(v || "").trim();
}

function pickShortLineFromScore(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return "No score yet.";
  if (s >= 95) return "Native-level clarity.";
  if (s >= 90) return "Excellent pronunciation.";
  if (s >= 75) return "Strong performance.";
  if (s >= 60) return "Room for improvement.";
  return "Needs focused practice.";
}

function fallbackLettersFromWord(wordText, phonemeIndex, phonemeCount) {
  const w = String(wordText || "").trim();
  if (!w) return "";

  const n = Math.max(1, Number(phonemeCount) || 1);
  const i = Math.max(0, Math.min(Number(phonemeIndex) || 0, n - 1));

  // simple proportional slice across characters
  const start = Math.floor((i * w.length) / n);
  const end = Math.floor(((i + 1) * w.length) / n);

  let chunk = w.slice(start, end).trim();

  // ensure non-empty (e.g. short words)
  if (!chunk) chunk = w.slice(start, start + 1).trim();
  if (!chunk) chunk = w; // last fallback

  return chunk;
}

function buildWeakPhonemeSlidesFromWords(wordsArr) {
  // One slide per phoneme code (e.g. "K"), even if it appears multiple times.
  // Keep the FIRST appearance order, but store the WORST (lowest) score instance.
  const byCode = new Map(); // code -> { order, slide }

  const words = Array.isArray(wordsArr) ? wordsArr : [];
  let orderCounter = 0;

  for (const w of words) {
    const wordText = String(w?.word || w?.text || "").trim();
    const ps = Array.isArray(w?.phonemes) ? w.phonemes : [];

    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const code = getPhonemeCode(p);
      if (!code) continue;

      const score = getScore(p);
      const isWeak = score == null || !isGreen(score);
      if (!isWeak) continue;

      const media = resolvePhonemeMedia(code);
      if (!media?.src) continue;

      const letters =
        getPhonemeLetters(p) ||
        fallbackLettersFromWord(wordText, i, ps.length) ||
        code;

      const candidate = {
        type: "phoneme",
        key: `${code}`, // unique per code
        code,
        letters,
        score,
        mediaKind: media.kind,
        mediaSrc: media.src,
      };

      const existing = byCode.get(code);

      // First time we see this phoneme: keep its order.
      if (!existing) {
        byCode.set(code, { order: orderCounter++, slide: candidate });
        continue;
      }

      // Already seen: keep the WORST (lowest) score.
      // Treat null as "worst possible".
      const prevScore = existing.slide?.score;
      const prevIsFinite = Number.isFinite(prevScore);
      const nextIsFinite = Number.isFinite(score);

      const shouldReplace =
        !nextIsFinite
          ? prevIsFinite // null beats a number (worse)
          : !prevIsFinite
            ? false // existing is null already (can't get worse)
            : score < prevScore;

      if (shouldReplace) {
        // preserve original order, only replace slide content
        byCode.set(code, { order: existing.order, slide: candidate });
      }
    }
  }

  // Return slides in first-appearance order
  return Array.from(byCode.values())
    .sort((a, b) => a.order - b.order)
    .map((x) => x.slide);
}

const PHONEME_SHORT_TIPS = {
  /* ---------------- VOWELS ---------------- */
  AA: "Drop your jaw and keep the mouth open. The tongue sits low and back, with relaxed lips. Hold it steady—don’t turn it into a glide.",
  AE: "Open your mouth and keep the tongue low but more forward than AA. The jaw is fairly open, and the sound feels wide and bright. Avoid sliding into EH.",
  AH: "Keep everything relaxed and neutral. The tongue is centered and the jaw is slightly open. Don’t round the lips or push the sound forward.",
  AO: "Open your mouth and round your lips slightly. The tongue sits low and back, and the sound should feel rounded and full. Don’t drift into OW.",
  AW: "Start like AA (open jaw), then glide into a small rounded W shape. The lips move forward as the sound finishes. Make the glide smooth, not choppy.",
  AY: "Start with an open AH/AA-like shape, then glide up to a tight ‘ee’ position. The tongue moves high and forward as you finish. Keep the glide continuous.",
  EH: "Jaw slightly open and lips relaxed (not smiling). The tongue is mid and forward, with a clear ‘bed’ quality. Avoid raising into IY.",
  ER: "Pull the tongue back and slightly up, and keep the lips lightly rounded. Keep it as one r-colored vowel—don’t add an extra R sound after it.",
  EY: "Begin with EH and glide lightly upward toward IY. The mouth narrows a bit as you finish. Keep it a small glide—don’t overdo it.",
  IH: "Lips relaxed, jaw slightly open, tongue high but not as high as IY. It’s short and crisp, like ‘bit’. Don’t stretch into a big smile.",
  IY: "Spread your lips slightly like a small smile. Lift the tongue high and forward, close to the hard palate. Keep it steady—don’t dip into IH.",
  OW: "Start with your mouth slightly open. Round your lips smoothly while the tongue moves back and slightly up. The motion should feel continuous, not abrupt.",
  OY: "Start with a rounded ‘oh’ shape, then glide into a tight ‘ee’ position. The lips begin rounded and then relax as the tongue moves forward. Make it smooth.",
  UH: "Lips lightly rounded and jaw slightly open. The tongue is high-back, making a compact sound. Don’t let it turn into a tense UW.",
  UW: "Round your lips into a small ‘oo’ and keep them forward. Raise the back of the tongue toward the soft palate. Keep it tight, not wide open.",

  // Common CMU “reduced/extra” vowels
  AX:  "Schwa: relaxed ‘uh’ in unstressed syllables. Keep the jaw loose and tongue neutral. Quick and effortless.",
  IX:  "Reduced high vowel (between IH/IY). Keep tongue high-ish and forward but loose. Very short and unstressed.",
  AXR: "Reduced ‘er’ (schwa+r) in endings like ‘teacher’. Keep it quick and unstressed—light R-coloring, not a strong ER.",
  OH:  "A smaller ‘oh’ glide (often like a shorter OW). Start more open, then round a bit more as you finish—don’t over-glide.",
  UX:  "Lax ‘oo’ (as in ‘book’). Lips only lightly rounded; tongue high-back but relaxed. Keep it short—don’t tense into UW.",

  /* ---------------- STOPS ---------------- */
  P: "Close both lips, build a little air pressure, then release cleanly. Voicing OFF (no vibration). Often a small puff of air at word start.",
  B: "Close both lips and release with voicing ON (vibration). Softer burst than P. Keep it quick—don’t add an extra ‘uh’.",
  T: "Tongue tip touches the ridge behind upper teeth. Release with a crisp burst, voicing OFF. Between vowels it may become a soft tap in American English.",
  D: "Tongue tip at the ridge behind upper teeth. Release with voicing ON. Keep it clean—don’t push the tongue forward into TH/DH territory.",
  K: "Back of the tongue touches the soft palate. Build pressure, then release sharply. Don’t let the tongue drag on release.",
  G: "Back of the tongue at the soft palate; release with voicing ON. Gentle, controlled burst—keep it tight.",

  /* ---------------- AFFRICATES ---------------- */
  CH: "One sound: start like T, then release into ‘sh’ friction (t+sh together). Lips may round slightly. Don’t separate it into two sounds.",
  JH: "One sound: start like D, then release into ‘zh’ friction (d+zh together). Keep voicing ON throughout. Don’t turn it into plain Z.",

  /* ---------------- FRICATIVES ---------------- */
  F:  "Top teeth lightly touch the lower lip. Push air through steadily. Smooth airflow—avoid a ‘puff’ burst.",
  V:  "Same as F but with voicing ON (feel vibration). Keep the airflow steady—don’t collapse into B.",
  S:  "Tongue close to the ridge without touching. Narrow groove for a sharp hiss. Lips relaxed—don’t round like SH.",
  Z:  "Same as S, but add voicing (vibration). Keep it continuous—don’t turn it into JH/zh.",
  SH: "Lips slightly rounded; tongue slightly back. Softer hiss than S. Continuous airflow—don’t add a T before it.",
  ZH: "Like SH but voiced (vibration), as in ‘measure’. Keep it continuous—don’t ‘pop’ it like JH.",
  TH: "Tongue tip gently between teeth (or at the edge). Blow air softly through the gap. Unvoiced—no vibration.",
  DH: "Same tongue position as TH, but voiced (vibration). Keep it light—don’t bite the tongue.",
  HH: "Open throat and let air flow like a soft breath. Mouth shape follows the next vowel. Don’t tighten into F/S-like friction.",

  /* ---------------- NASALS ---------------- */
  M:  "Close lips and let sound resonate through the nose (voicing ON). Keep it steady and smooth into the next sound.",
  N:  "Tongue tip at the ridge; sound through the nose (voicing ON). Release cleanly into the next sound.",
  NG: "Back of tongue at soft palate; air through the nose. It’s one nasal sound—don’t add a hard G at the end.",

  /* ---------------- LIQUIDS / APPROXIMANTS ---------------- */
  L: "Tongue tip touches the ridge while air flows around the sides. Start-of-word L is clear; end-of-word ‘dark L’ pulls the tongue back slightly.",
  R: "Curl the tongue tip slightly back (or bunch the tongue) without touching. Lips may round a bit. Keep it tense—don’t add a vowel after it.",
  W: "Round lips forward tightly like ‘oo’ and keep tongue back. Quick glide into the next vowel—don’t hold it like UW.",
  Y: "Tongue high and forward like the start of IY. Quick glide into the next vowel. Lips relaxed—no rounding like W.",

  /* ---------------- COMMON CMU “variants” (often appear in forced alignment / ASR) ---------------- */
  DX: "Flap/tap (American ‘t/d’ between vowels): tongue quickly taps the ridge once (like in ‘water’). Very short—no strong burst.",
  EL: "Syllabic dark L (as in ‘bottle’). Tongue tip may touch lightly, but the back of tongue stays pulled back. Keep it smooth—don’t insert a big vowel.",
  EM: "Syllabic M (as in some ‘rhythm’-like reductions). Lips closed; voicing ON; nasal resonance carries the syllable. Don’t add an extra vowel.",
  EN: "Syllabic N (like a reduced ‘n’ syllable). Tongue at the ridge; voicing ON; nasal resonance carries it. Keep it short.",
  NX: "Nasal flap (rare). Similar to a quick N-like tap in very fast speech. Keep it extremely short and light—avoid over-articulating.",
  Q:  "Glottal stop (as in some ‘uh-oh’ cuts). Brief throat closure, then release. No tongue/lip shaping—just a quick stop.",
};


function getShortTipForPhoneme(code) {
  const c = String(code || "").toUpperCase();
  return PHONEME_SHORT_TIPS[c] || "Focus on mouth shape and airflow for this sound.";
}

// ---------------- Deep Dive examples (TTS-driven) ----------------
// NOTE: This supports ALL phonemes via fallback. Add more entries over time.
const PHONEME_DEEP_DIVE = {
  /* ---------------- VOWELS ---------------- */

  AA: {
    contrastLabel: "AA vs AE",
    minimalPairs: [
      ["cot", "cat"],
      ["sock", "sack"],
      ["Don", "Dan"],
      ["hot", "hat"],
    ],
    positions: {
      start: ["odd", "on", "ox", "honest"],
      mid: ["father", "college", "problem"],
      end: ["spa", "bra", "ma", "blah"],
    },
    drills: ["Hot coffee, not tea.", "Don got the job."],
  },

  AO: {
    contrastLabel: "AO vs AA",
    minimalPairs: [
      ["caught", "cot"],
      ["law", "la"],
      ["talk", "tock"],
      ["dawn", "Don"],
    ],
    positions: {
      start: ["all", "often", "ought", "always"],
      mid: ["author", "coffee", "laundry"],
      end: ["saw", "law", "raw", "jaw"],
    },
    drills: ["I saw Paul draw a tall wall.", "Talk slower, not louder."],
  },

  OH: {
    contrastLabel: "OH vs OW",
    minimalPairs: [
      ["oh", "owe"],
      ["role", "roll"],
      ["stole", "stow"],
      ["close", "clothes"],
    ],
    positions: {
      start: ["open", "old", "over", "only"],
      mid: ["moment", "hotel", "robot"],
      end: ["go", "no", "so", "show"],
    },
    drills: ["Oh no—go home slowly.", "Open the old door."],
  },

  AH: {
    contrastLabel: "AH vs AA",
    minimalPairs: [
      ["cut", "cot"],
      ["luck", "lock"],
      ["buck", "bock"],
      ["sun", "son"],
    ],
    positions: {
      start: ["up", "under", "other", "uncle"],
      mid: ["money", "summer", "public"],
      end: ["huh", "duh", "uh", "bruh"],
    },
    drills: ["A fun lunch on Sunday.", "Cut the sum in half."],
  },

  AX: {
    contrastLabel: "AX (schwa) vs AH",
    minimalPairs: [
      ["sofa", "suffer"],
      ["about", "a-bout"],
      ["ago", "ugh"],
      ["support", "sup-port"],
    ],
    positions: {
      start: ["about", "alone", "awake", "aside"],
      mid: ["sofa", "comma", "banana"],
      end: ["Russia", "America", "idea"],
    },
    drills: ["About a minute ago.", "I can do it in a second."],
  },

  AXR: {
    contrastLabel: "AXR (schwa+r) vs ER",
    minimalPairs: [
      ["teacher", "techer"], // practice target is the -er ending
      ["baker", "barker"],
      ["butter", "better"],
      ["runner", "renter"],
    ],
    positions: {
      start: ["arise", "around", "arrive"], // r-colored reduction often shows up after /ə/
      mid: ["teacher", "doctor", "better", "butter"],
      end: ["mother", "father", "teacher", "runner"],
    },
    drills: ["The teacher talked faster.", "A runner and a baker."],
  },

  AE: {
    contrastLabel: "AE vs EH",
    minimalPairs: [
      ["bat", "bet"],
      ["had", "head"],
      ["pack", "peck"],
      ["bad", "bed"],
    ],
    positions: {
      start: ["ask", "add", "after", "animal"],
      mid: ["happy", "cabin", "basket"],
      end: ["cat", "hat", "flat", "trap"],
    },
    drills: ["Pack that black backpack.", "Dan has a bad habit."],
  },

  EH: {
    contrastLabel: "EH vs IH",
    minimalPairs: [
      ["bet", "bit"],
      ["pen", "pin"],
      ["set", "sit"],
      ["sell", "sill"],
    ],
    positions: {
      start: ["end", "enter", "every", "else"],
      mid: ["better", "message", "tennis"],
      end: ["bed", "red", "said", "fed"],
    },
    drills: ["Ben said yes.", "Send the letter next."],
  },

  IH: {
    contrastLabel: "IH vs IY",
    minimalPairs: [
      ["bit", "beet"],
      ["sit", "seat"],
      ["live", "leave"],
      ["ship", "sheep"],
    ],
    positions: {
      start: ["in", "is", "if", "image"],
      mid: ["city", "minute", "finish"],
      end: ["sit", "hit", "six", "kick"],
    },
    drills: ["Six big fish in a bin.", "This is it."],
  },

  IX: {
    contrastLabel: "IX (reduced high vowel) vs IH",
    minimalPairs: [
      ["roses", "Ross"], // reduced vowel in plural/suffix
      ["wanted", "want"], // reduced vowel in -ed
      ["boxes", "box"],
      ["rabbits", "rab"], // suffix reduction target
    ],
    positions: {
      start: ["enough", "effect", "event"],
      mid: ["roses", "boxes", "wanted", "rabbit"],
      end: ["happy", "pretty", "city"], // final reduced vowel feel
    },
    drills: ["He wanted it quickly.", "Roses and boxes."],
  },

  IY: {
    contrastLabel: "IY vs IH",
    minimalPairs: [
      ["beet", "bit"],
      ["seat", "sit"],
      ["leave", "live"],
      ["sheep", "ship"],
    ],
    positions: {
      start: ["eat", "each", "even", "easy"],
      mid: ["people", "needed", "reason"],
      end: ["see", "me", "free", "key"],
    },
    drills: ["Please keep it clean.", "We need three seats."],
  },

  EY: {
    contrastLabel: "EY vs EH",
    minimalPairs: [
      ["late", "let"],
      ["bait", "bet"],
      ["pain", "pen"],
      ["sale", "sell"],
    ],
    positions: {
      start: ["aim", "age", "eight", "able"],
      mid: ["paper", "later", "basic"],
      end: ["day", "say", "play", "way"],
    },
    drills: ["Pay the same rate.", "Take a break today."],
  },

  AY: {
    contrastLabel: "AY vs EY",
    minimalPairs: [
      ["bite", "bait"],
      ["price", "praise"],
      ["line", "lane"],
      ["time", "tame"],
    ],
    positions: {
      start: ["ice", "idea", "item", "I"],
      mid: ["private", "silent", "tiny"],
      end: ["my", "try", "buy", "sky"],
    },
    drills: ["I like the bright light.", "My time is tight."],
  },

  OW: {
    contrastLabel: "OW vs OH",
    minimalPairs: [
      ["owe", "oh"],
      ["boat", "bought"],
      ["coat", "caught"],
      ["load", "laud"],
    ],
    positions: {
      start: ["oat", "open", "over", "only"],
      mid: ["hotel", "moment", "focus"],
      end: ["go", "so", "no", "show"],
    },
    drills: ["Go home slowly.", "Don’t overdo it."],
  },

  AW: {
    contrastLabel: "AW vs AO",
    minimalPairs: [
      ["loud", "laud"],
      ["out", "ought"],
      ["cow", "caw"],
      ["down", "dawn"],
    ],
    positions: {
      start: ["out", "our", "owl", "outside"],
      mid: ["power", "tower", "hour"],
      end: ["now", "how", "wow", "cow"],
    },
    drills: ["How now? Slow down.", "Our house is out of town."],
  },

  OY: {
    contrastLabel: "OY vs OW",
    minimalPairs: [
      ["boy", "bow"],
      ["soy", "so"],
      ["coin", "cone"],
      ["toys", "toes"],
    ],
    positions: {
      start: ["oil", "oyster", "oy!"],
      mid: ["choice", "point", "voice"],
      end: ["boy", "toy", "joy", "ploy"],
    },
    drills: ["The boy’s choice is noisy.", "Point to the coin."],
  },

  UH: {
    contrastLabel: "UH vs UW",
    minimalPairs: [
      ["pull", "pool"],
      ["full", "fool"],
      ["look", "Luke"],
      ["could", "cooed"],
    ],
    positions: {
      start: ["book", "bull", "could", "cook"],
      mid: ["cookie", "looking", "footprint"],
      end: ["pull", "full", "look", "hook"],
    },
    drills: ["Look at the good book.", "Pull the hood up."],
  },

  UW: {
    contrastLabel: "UW vs UH",
    minimalPairs: [
      ["pool", "pull"],
      ["fool", "full"],
      ["Luke", "look"],
      ["food", "foot"],
    ],
    positions: {
      start: ["too", "two", "tool", "truth"],
      mid: ["moving", "student", "music"],
      end: ["blue", "do", "you", "true"],
    },
    drills: ["You do it too soon.", "Move the food to the room."],
  },

  UX: {
    contrastLabel: "UX vs UW (lax vs tense)",
    minimalPairs: [
      ["boot", "book"],
      ["Luke", "look"],
      ["food", "foot"],
      ["pool", "pull"],
    ],
    positions: {
      start: ["foot", "look", "book", "good"],
      mid: ["cookie", "looking", "footage"],
      end: ["took", "cook", "hook", "look"],
    },
    drills: ["Good look—book it.", "He took the cook book."],
  },

  ER: {
    contrastLabel: "ER vs AH",
    minimalPairs: [
      ["bird", "bud"],
      ["hurt", "hut"],
      ["her", "huh"],
      ["sir", "suh"],
    ],
    positions: {
      start: ["earth", "earn", "early"],
      mid: ["perfect", "person", "service"],
      end: ["her", "sir", "fur", "curb"],
    },
    drills: ["Her work is perfect.", "Turn first, then circle."],
  },

  /* ---------------- CONSONANTS ---------------- */

  P: {
    contrastLabel: "P vs B",
    minimalPairs: [
      ["pat", "bat"],
      ["cap", "cab"],
      ["rip", "rib"],
      ["pear", "bear"],
    ],
    positions: {
      start: ["pay", "pin", "pack", "paper"],
      mid: ["happy", "open", "supper"],
      end: ["cap", "ship", "stop", "sleep"],
    },
    drills: ["Pack the paper properly.", "Pick a proper path."],
  },

  B: {
    contrastLabel: "B vs P",
    minimalPairs: [
      ["bat", "pat"],
      ["cab", "cap"],
      ["rib", "rip"],
      ["bear", "pear"],
    ],
    positions: {
      start: ["be", "big", "back", "best"],
      mid: ["maybe", "about", "ribbon"],
      end: ["cab", "job", "rib", "web"],
    },
    drills: ["Bob bought a big bag.", "Bring back the book."],
  },

  T: {
    contrastLabel: "T vs D",
    minimalPairs: [
      ["two", "do"],
      ["ten", "den"],
      ["bet", "bed"],
      ["tie", "die"],
    ],
    positions: {
      start: ["time", "take", "top", "team"],
      mid: ["water", "pretty", "later"],
      end: ["cat", "seat", "wait", "right"],
    },
    drills: ["Take two tiny tasks.", "Put it on the table."],
  },

  D: {
    contrastLabel: "D vs T",
    minimalPairs: [
      ["do", "two"],
      ["den", "ten"],
      ["bed", "bet"],
      ["die", "tie"],
    ],
    positions: {
      start: ["day", "do", "deep", "door"],
      mid: ["ladder", "ready", "body"],
      end: ["bad", "need", "road", "side"],
    },
    drills: ["Do it today.", "Add a little detail."],
  },

  K: {
    contrastLabel: "K vs G",
    minimalPairs: [
      ["coat", "goat"],
      ["back", "bag"],
      ["cold", "gold"],
      ["cap", "gap"],
    ],
    positions: {
      start: ["cat", "key", "keep", "kind"],
      mid: ["baker", "soccer", "vacant"],
      end: ["back", "talk", "weak", "luck"],
    },
    drills: ["Kate keeps a calm pace.", "I packed a quick snack."],
  },

  G: {
    contrastLabel: "G vs K",
    minimalPairs: [
      ["goat", "coat"],
      ["bag", "back"],
      ["gold", "cold"],
      ["gap", "cap"],
    ],
    positions: {
      start: ["go", "game", "good", "give"],
      mid: ["bigger", "again", "eagle"],
      end: ["bag", "big", "dog", "log"],
    },
    drills: ["Go get a good bag.", "I got a big dog."],
  },

  CH: {
    contrastLabel: "CH vs SH",
    minimalPairs: [
      ["chew", "shoo"],
      ["chin", "shin"],
      ["cheap", "sheep"],
      ["choke", "shoal"],
    ],
    positions: {
      start: ["cheese", "check", "chair", "choice"],
      mid: ["teacher", "kitchen", "nature"],
      end: ["match", "peach", "watch", "reach"],
    },
    drills: ["Choose a cheap chair.", "Watch the teacher check."],
  },

  JH: {
    contrastLabel: "JH vs CH",
    minimalPairs: [
      ["gin", "chin"],
      ["jeep", "cheap"],
      ["jam", "cham"],
      ["joke", "choke"],
    ],
    positions: {
      start: ["job", "just", "joke", "June"],
      mid: ["major", "agent", "enjoy", "rejoice"],
      end: ["badge", "edge", "page", "bridge"],
    },
    drills: ["Just change the joke.", "Enjoy the jam in June."],
  },


  F: {
    contrastLabel: "F vs V",
    minimalPairs: [
      ["fan", "van"],
      ["fine", "vine"],
      ["safe", "save"],
      ["leaf", "leave"],
    ],
    positions: {
      start: ["fish", "fast", "feel", "fun"],
      mid: ["coffee", "before", "offer"],
      end: ["leaf", "life", "off", "safe"],
    },
    drills: ["Feel the fresh air.", "Five fast friends."],
  },

  V: {
    contrastLabel: "V vs F",
    minimalPairs: [
      ["van", "fan"],
      ["vine", "fine"],
      ["save", "safe"],
      ["leave", "leaf"],
    ],
    positions: {
      start: ["very", "voice", "view", "visit"],
      mid: ["movie", "never", "even"],
      end: ["save", "love", "move", "give"],
    },
    drills: ["Very vivid views.", "Save five minutes."],
  },

  TH: {
    contrastLabel: "TH vs T",
    minimalPairs: [
      ["thin", "tin"],
      ["thank", "tank"],
      ["thought", "taught"],
      ["three", "tree"],
    ],
    positions: {
      start: ["thin", "think", "thank", "three"],
      mid: ["author", "method", "healthy"],
      end: ["bath", "teeth", "mouth", "truth"],
    },
    drills: ["Think through the thin thread.", "Three things to thank them for."],
  },

  DH: {
    contrastLabel: "DH vs D",
    minimalPairs: [
      ["then", "den"],
      ["they", "day"],
      ["these", "dees"],
      ["those", "doze"],
    ],
    positions: {
      start: ["this", "that", "they", "these"],
      mid: ["mother", "weather", "bother"],
      end: ["breathe", "bathe", "smooth"],
    },
    drills: ["This and that—those are theirs.", "They’re there this time."],
  },

  S: {
    contrastLabel: "S vs SH",
    minimalPairs: [
      ["sip", "ship"],
      ["see", "she"],
      ["sock", "shock"],
      ["seal", "sheal"],
    ],
    positions: {
      start: ["see", "sun", "safe", "simple"],
      mid: ["basic", "racing", "lesson"],
      end: ["bus", "miss", "ice", "peace"],
    },
    drills: ["Sam sees six sunny seats.", "Stop and sit still."],
  },

  Z: {
    contrastLabel: "Z vs S",
    minimalPairs: [
      ["zip", "sip"],
      ["zeal", "seal"],
      ["buzz", "bus"],
      ["rise", "rice"],
    ],
    positions: {
      start: ["zoo", "zip", "zero", "zone"],
      mid: ["music", "reason", "lazy"],
      end: ["buzz", "raise", "phase", "nose"],
    },
    drills: ["Zoe zooms to the zoo.", "These days, I rise early."],
  },

  SH: {
    contrastLabel: "SH vs S",
    minimalPairs: [
      ["ship", "sip"],
      ["she", "see"],
      ["shock", "sock"],
      ["wish", "wiss"],
    ],
    positions: {
      start: ["she", "show", "ship", "shade"],
      mid: ["nation", "fashion", "washing"],
      end: ["wish", "fish", "push", "cash"],
    },
    drills: ["She should show six shoes.", "Push the trash."],
  },

  ZH: {
    contrastLabel: "ZH vs SH (voiced vs unvoiced)",
    minimalPairs: [
      ["measure", "mesher"],
      ["vision", "vicious"],   // contrast target: voiced ZH vs unvoiced SH-like feel
      ["pleasure", "plusher"], // closer contrast pair
      ["beige", "bash"],       // not a perfect minimal pair, but strong contrast for practice
    ],
    positions: {
      start: ["genre", "Zsa Zsa"], // rare; names/loanwords
      mid: ["measure", "vision", "usual", "pleasure"],
      end: ["beige", "rouge"],
    },
    drills: ["Measure the pleasure.", "His usual vision was clear."],
  },


  HH: {
    contrastLabel: "HH vs (no H)",
    minimalPairs: [
      ["heat", "eat"],
      ["hill", "ill"],
      ["hat", "at"],
      ["hold", "old"],
    ],
    positions: {
      start: ["he", "home", "happy", "help"],
      mid: ["ahead", "behave", "perhaps"],
      end: ["ahh"], // rare
    },
    drills: ["He held his hat.", "Help her hurry home."],
  },

  M: {
    contrastLabel: "M vs N",
    minimalPairs: [
      ["map", "nap"],
      ["sum", "sun"],
      ["team", "teen"],
      ["rum", "run"],
    ],
    positions: {
      start: ["me", "make", "more", "maybe"],
      mid: ["summer", "common", "remember"],
      end: ["time", "home", "team", "room"],
    },
    drills: ["Make more money tomorrow.", "My mom made a meal."],
  },

  N: {
    contrastLabel: "N vs NG",
    minimalPairs: [
      ["thin", "thing"],
      ["ran", "rang"],
      ["sin", "sing"],
      ["ban", "bang"],
    ],
    positions: {
      start: ["no", "need", "nice", "next"],
      mid: ["tennis", "money", "under"],
      end: ["ten", "rain", "seen", "down"],
    },
    drills: ["No need to panic.", "Ten nice notes."],
  },

  NG: {
    contrastLabel: "NG vs N",
    minimalPairs: [
      ["sin", "sing"],
      ["thin", "thing"],
      ["ran", "rang"],
      ["ban", "bang"],
    ],
  positions: {
  start: ["Nguyen", "ngoni", "ngoma"], // rare in English; common in names/loanwords
  mid: ["finger", "anger", "single"],
  end: ["sing", "long", "wrong", "ring"],
},

    drills: ["Sing a long song.", "Bring the thing along."],
  },

  L: {
    contrastLabel: "L vs R",
    minimalPairs: [
      ["light", "right"],
      ["load", "road"],
      ["lice", "rice"],
      ["glass", "grass"],
    ],
    positions: {
      start: ["light", "look", "love", "late"],
      mid: ["yellow", "alive", "belly"],
      end: ["ball", "feel", "tall", "small"],
    },
    drills: ["Let Lily lead the line.", "I feel a little better."],
  },

  R: {
    contrastLabel: "R vs L",
    minimalPairs: [
      ["right", "light"],
      ["road", "load"],
      ["rice", "lice"],
      ["glass", "grass"],
    ],
    positions: {
      start: ["red", "right", "river", "road"],
      mid: ["carry", "around", "correct"],
      end: ["car", "far", "more", "door"],
    },
    drills: ["Run right down the road.", "A rare red bird."],
  },

  W: {
    contrastLabel: "W vs Y",
    minimalPairs: [
      ["wet", "yet"],
      ["wine", "yine"], // conceptual
      ["witch", "which"], // classic
      ["Wes", "yes"],
    ],
    positions: {
  start: ["we", "way", "work", "window"],
  mid: ["always", "away", "between"],
  end: [], // word-final /w/ is not typical in English; it’s usually part of diphthongs (AW/OW/UW)
},

    drills: ["We will win.", "Walk away slowly."],
  },

  Y: {
    contrastLabel: "Y vs W",
    minimalPairs: [
      ["yet", "wet"],
      ["yell", "well"],
      ["yawn", "won"],
      ["year", "wear"],
    ],
   positions: {
  start: ["yes", "you", "year", "yellow"],
  mid: ["beyond", "music", "million"],
  end: [], // word-final /y/ isn't typical; it’s usually an IY/AY ending instead
},

    drills: ["Yes, you can.", "A yellow yearbook."],
  },
};


// ---------------- Confusable partners (for showing "X vs Y" for ALL relevant CMU phonemes) ----------------
const CONFUSABLE_PARTNER = {
  // Vowels
  AA: "AE",
  AE: "EH",
  AH: "AA",
  AO: "AA",
  AY: "EY",
  EH: "IH",
  ER: "AH",
  EY: "EH",
  IH: "IY",
  IY: "IH",
  AX: "AH",
  OH: "OW",
  OW: "OH",
  UH: "UW",
  UW: "UH",
  UX: "UW",

  // Consonants
  P: "B",
  B: "P",
  T: "D",
  D: "T",
  K: "G",
  G: "K",
  CH: "SH",
  JH: "CH",
  F: "V",
  V: "F",
  TH: "T",
  DH: "D",
  S: "SH",
  Z: "S",
  SH: "S",
  M: "N",
  N: "NG",
  NG: "N",
  L: "R",
  R: "L",
  W: "Y",
  Y: "W",
};

function getConfusablePartner(code) {
  const c = String(code || "").trim().toUpperCase();
  return CONFUSABLE_PARTNER[c] || null;
}


function generateDeepDiveFallback(code) {
  const c = String(code || "").trim().toUpperCase();
  const partner = getConfusablePartner(c);

  return {
    // gør UI stabilt for ALLE phonemer
    contrastLabel: partner ? `${c} vs ${partner}` : `${c} (Deep Dive)`,
    minimalPairs: [],
    positions: { start: [], mid: [], end: [] },
    drills: [],
  };
}


function getDeepDiveForPhoneme(code) {
  const c = String(code || "").trim().toUpperCase();
  const base = PHONEME_DEEP_DIVE[c] || generateDeepDiveFallback(c);

  const partner = getConfusablePartner(c);

  // If we have a confusable partner, always show "X vs Y" unless the entry already has its own label.
  if (partner && !base?.contrastLabel) {
    return { ...base, contrastLabel: `${c} vs ${partner}` };
  }

  // If the existing label doesn't include "vs" but we do have a partner, prefer "X vs Y"
  // (but keep special labels like "HH vs (no H)" as-is since HH has no partner anyway).
  if (partner && typeof base?.contrastLabel === "string" && !base.contrastLabel.includes(" vs ")) {
    return { ...base, contrastLabel: `${c} vs ${partner}` };
  }

  return base;
}




export default function PracticeMyText() {
  const nav = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
    // -------- shared page: practice + coach --------
  const mode = location?.state?.mode === "coach" ? "coach" : "practice";
  const backRoute = location?.state?.backRoute || (mode === "coach" ? "/coach" : "/practice");
  const title = mode === "coach" ? "Coach My Text" : "Practice My Text";
  const RESULT_KEY = mode === "coach" ? "ac_coach_my_text_result_v1" : "ac_practice_my_text_result_v1";


  const MAX_LEN = 120;

// Page (light) + header (dark) like your screenshot
const PAGE_BG = "#EEF5FF";
const PAGE_TEXT = "#0B1220";
const PAGE_MUTED = "rgba(11,18,32,0.55)";
const PAGE_BORDER = "rgba(11,18,32,0.10)";
const PAGE_SURFACE = "rgba(255,255,255,0.88)";
const PAGE_SHADOW = "0 10px 24px rgba(0,0,0,0.06)";

const HEADER_BG = "#0B1220";
const HEADER_TEXT = "rgba(255,255,255,0.92)";
const HEADER_MUTED = "rgba(255,255,255,0.70)";
const HEADER_BORDER = "rgba(255,255,255,0.12)";
const HEADER_SURFACE = "rgba(255,255,255,0.10)";

const SEND_PURPLE = "#8B5CF6";


  const TABBAR_OFFSET = 64;
  const SAFE_BOTTOM = "env(safe-area-inset-bottom, 0px)";
  const SAFE_TOP = "env(safe-area-inset-top, 0px)";
useEffect(() => {
  const prevBody = document.body.style.background;
  const prevHtml = document.documentElement.style.background;
  document.body.style.background = PAGE_BG;
  document.documentElement.style.background = PAGE_BG;
  return () => {
    document.body.style.background = prevBody;
    document.documentElement.style.background = prevHtml;
  };
}, [PAGE_BG]);


  // keep SFX volume synced with settings (0 = mute)
  useEffect(() => {
    sfx.setVolume(settings.volume ?? 0.6);
  }, [settings.volume]);
  const canPlaySfx = (settings.volume ?? 0) > 0.001;
const [trophyCelebration, setTrophyCelebration] = useState(false);
const trophyTimerRef = useRef(null);

function triggerTrophyCelebration() {
  // kun én gang per device
  if (hasTrophyCelebrated()) return;

  markTrophyCelebrated();

  if (canPlaySfx) sfx.success({ strength: 2 });

  setTrophyCelebration(true);

  try { if (trophyTimerRef.current) clearTimeout(trophyTimerRef.current); } catch {}
  trophyTimerRef.current = setTimeout(() => {
    setTrophyCelebration(false);
    trophyTimerRef.current = null;
  }, 2400);
}

  const [accentUi, setAccentUi] = useState(settings.accentDefault || "en_us");
  useEffect(() => {
  // on unmount: stop + cleanup
  return () => {
    try { ttsAbortRef.current?.abort(); } catch {}
    ttsAbortRef.current = null;

    try {
      const a = ttsAudioRef.current;
      if (a) {
        a.pause();
        a.src = "";
      }
    } catch {}

    // revoke current non-cached url
    try { if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current); } catch {}
    ttsUrlRef.current = null;

    // revoke cached urls
    try {
      for (const url of ttsCacheRef.current.values()) {
        try { URL.revokeObjectURL(url); } catch {}
      }
      ttsCacheRef.current.clear();
    } catch {}
  };
}, []);
useEffect(() => {
  try { ttsAbortRef.current?.abort(); } catch {}
  ttsAbortRef.current = null;

  try {
    const a = ttsAudioRef.current;
    if (a) {
      a.pause();
      a.src = "";
    }
  } catch {}
  setIsCorrectPlaying(false);

  // revoke current non-cached url
  try { if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current); } catch {}
  ttsUrlRef.current = null;

  // revoke cached urls
  try {
    for (const url of ttsCacheRef.current.values()) {
      try { URL.revokeObjectURL(url); } catch {}
    }
    ttsCacheRef.current.clear();
  } catch {}
}, [accentUi]);

  useEffect(() => setAccentUi(settings.accentDefault || "en_us"), [settings.accentDefault]);

  const [refText, setRefText] = useState("");
  useEffect(() => {
  if (refText.length > MAX_LEN) {
    setRefText(refText.slice(0, MAX_LEN));
  }
}, [refText, MAX_LEN]);

  const [err, setErr] = useState("");


  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isBusy = isRecording || isAnalyzing;

  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const [lastUrl, setLastUrl] = useState(null);
  const lastAudioBlobRef = useRef(null);
const lastAudioUrlRef = useRef(null);

const [canRetryAnalyze, setCanRetryAnalyze] = useState(false);


  const [result, setResult] = useState(null);
  const [overallPctLocked, setOverallPctLocked] = useState(0);
  const deckPctRef = useRef(null);
const [deckPctLocked, setDeckPctLocked] = useState(0);
const deckScore = Number.isFinite(deckPctLocked) ? deckPctLocked : 0;


  const [isClosingSlides, setIsClosingSlides] = useState(false);

  // Load analysis result from Practice.jsx (via navigate state or sessionStorage)
useEffect(() => {
    if (isClosingSlides) return;

  const fromState = location?.state?.result || null;

  if (fromState) {
    setResult(fromState);
    const v = fromState?.overall ?? fromState?.pronunciation ?? fromState?.overallAccuracy ?? 0;
const n = Number(v);
const pct = Number.isFinite(n) ? (n <= 1 ? Math.round(n * 100) : Math.round(n)) : 0;
setOverallPctLocked(Math.max(0, Math.min(100, pct)));


    // ✅ sync UI with the result we arrived with
    setAccentUi(fromState?.accent || settings?.accentDefault || "en_us");
    setRefText(String(fromState?.refText || ""));

    // ✅ keep audio around so accent changes can re-analyze same take
    lastAudioBlobRef.current = fromState?.userAudioBlob || null;
    lastAudioUrlRef.current  = fromState?.userAudioUrl  || null;

    try { sessionStorage.setItem(RESULT_KEY, JSON.stringify(fromState)); } catch {}
    return;
  }

  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      setResult(parsed);
      const v = parsed?.overall ?? parsed?.pronunciation ?? parsed?.overallAccuracy ?? 0;
const n = Number(v);
const pct = Number.isFinite(n) ? (n <= 1 ? Math.round(n * 100) : Math.round(n)) : 0;
setOverallPctLocked(Math.max(0, Math.min(100, pct)));

      setAccentUi(parsed?.accent || settings?.accentDefault || "en_us");
      setRefText(String(parsed?.refText || ""));
      // NOTE: blob is usually not in sessionStorage; url might be.
      lastAudioBlobRef.current = parsed?.userAudioBlob || null;
      lastAudioUrlRef.current  = parsed?.userAudioUrl  || null;
    }
  } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [location.key, settings?.accentDefault]);


// ---------------- Slide flow state ----------------
const [slideIdx, setSlideIdx] = useState(0);

// Slide 1 animation phases
// -1 = hidden, 0 = word fades in (center), 1 = word moves up + percent appears + count up,
// 2 = show message (hold), 3 = message fades out, 4 = word/% collapse to top + details appear
const [introPhase, setIntroPhase] = useState(-1);

const [introPct, setIntroPct] = useState(0);
// --- slide 1 hero anchors (center -> top) ---
const heroCenterRef = useRef(null);
const heroTopRef = useRef(null);
const [heroDeltaY, setHeroDeltaY] = useState(0);

// Slide 2 (Speaking Level) animation
const [levelPctAnim, setLevelPctAnim] = useState(0);
const [overlayReady, setOverlayReady] = useState(false);

// keep intro timers in one place so we never “double-run”
const introTimersRef = useRef([]);
function clearIntroTimers() {
  for (const id of introTimersRef.current) clearTimeout(id);
  introTimersRef.current = [];
}


const [loopOn, setLoopOn] = useState(false);
const [playbackRate, setPlaybackRate] = useState(1.0);
const [deepDiveOpen, setDeepDiveOpen] = useState(false);
const [deepDivePhoneme, setDeepDivePhoneme] = useState(null); // { code, letters }
useEffect(() => {
  if (!deepDiveOpen) return;

  let cancelled = false;

  (async () => {
    const code = String(deepDivePhoneme?.code || "").toUpperCase();
    if (!code) return;

    const dd = getDeepDiveForPhoneme(code);
    const accent = accentUi === "en_br" ? "en_br" : "en_us";

    // Prefetch only the most likely rate (current), so it matches clicks
    const rate = Number(playbackRate ?? 1.0) || 1.0;

    // Collect texts shown in Deep Dive
    const texts = [];

    if (Array.isArray(dd?.minimalPairs)) {
      for (const pair of dd.minimalPairs) {
        if (Array.isArray(pair) && pair.length >= 2) {
          texts.push(pair[0], pair[1]);
        }
      }
    }

    const pos = dd?.positions || {};
    for (const w of (pos.start || [])) texts.push(w);
    for (const w of (pos.mid || [])) texts.push(w);
    for (const w of (pos.end || [])) texts.push(w);

    if (Array.isArray(dd?.drills)) {
      for (const s of dd.drills) texts.push(s);
    }

    // Dedup + cap so we don’t spam the server
    const unique = Array.from(new Set(texts.map((x) => String(x || "").trim()).filter(Boolean))).slice(0, 40);

    // Prefetch sequentially (stable + gentle)
    for (const t of unique) {
      if (cancelled) return;
      try {
        await prefetchTtsUrl({ text: t, accent, rate });
      } catch {}
    }
  })();

  return () => {
    cancelled = true;
  };
}, [deepDiveOpen, deepDivePhoneme?.code, accentUi, playbackRate]);


const userAudioRef = useRef(null);
const loopTimerRef = useRef(null);
// ---------------- TTS (server /api/tts) ----------------
const ttsAudioRef = useRef(null);
const ttsUrlRef = useRef(null); // current objectURL (non-cached)
const ttsAbortRef = useRef(null);
const ttsPlayIdRef = useRef(0);

// cache objectURLs by key: `${accentUi}|${rate}|${text}`
const ttsCacheRef = useRef(new Map());

const [isCorrectPlaying, setIsCorrectPlaying] = useState(false);
// Deep Dive TTS (same /api/tts, but for words/sentences)
const [deepDivePlayingKey, setDeepDivePlayingKey] = useState(null); // string|null

async function playDeepDiveTts(text, key) {
  const t = String(text || "").trim();
  if (!t) return;

  // toggle off if same item is playing
  if (deepDivePlayingKey === key && isCorrectPlaying) {
    stopTtsNow();
    setDeepDivePlayingKey(null);
    return;
  }

  stopAllAudio();

  const accent = accentUi === "en_br" ? "en_br" : "en_us";
  const rate = Number(playbackRate ?? 1.0) || 1.0;

  try {
    setDeepDivePlayingKey(key);
    const url = await ensureTtsUrl({ text: t, accent, rate });
    await playTtsUrl(url, { rate, loop: false });
  } catch (e) {
    setDeepDivePlayingKey(null);
    if (!IS_PROD) setErr(e?.message || String(e));
    else setErr("TTS failed. Try again.");
  }
}

const phonemeVideoRef = useRef(null);
const [phonemeVideoPlaying, setPhonemeVideoPlaying] = useState(false);

const overallScore = useMemo(() => {
  const v = result?.overall ?? result?.pronunciation ?? result?.overallAccuracy ?? null;
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}, [result]);

const heroText = useMemo(() => String(result?.refText || "").trim(), [result]);

const words = useMemo(() => normalizeWordsFromResult(result, result?.refText), [result]);

const weakPhonemeSlides = useMemo(() => buildWeakPhonemeSlidesFromWords(words), [words]);

const totalSlides = useMemo(() => {
  // 1 intro + 1 level + phonemeSlides + 1 playback + 1 actions
  return 1 + 1 + weakPhonemeSlides.length + 1 + 1;
}, [weakPhonemeSlides.length]);


function clampSlide(i) {
  return Math.max(0, Math.min(i, totalSlides - 1));
}

function goPrev() {
  setPhonemeVideoPlaying(false);
  try { phonemeVideoRef.current?.pause(); } catch {}
  setSlideIdx((i) => clampSlide(i - 1));
}
function goNext() {
  setPhonemeVideoPlaying(false);
  try { phonemeVideoRef.current?.pause(); } catch {}
  setSlideIdx((i) => clampSlide(i + 1));
}

const isPhonemeOverlay =
  slideIdx >= 2 && slideIdx <= 1 + weakPhonemeSlides.length;
const activePhonemeSlide = isPhonemeOverlay ? weakPhonemeSlides[slideIdx - 2] : null;
useLayoutEffect(() => {
  if (!result) {
    setOverlayReady(false);
    return;
  }

  // Hide overlay, reset state BEFORE first paint of the overlay
  setOverlayReady(false);
  clearIntroTimers();

  setSlideIdx(0);
  setIntroPct(0);
  setLevelPctAnim(0);
  setIntroPhase(-1);

  // show overlay next frame (after reset is committed)
  requestAnimationFrame(() => setOverlayReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [result]);
useLayoutEffect(() => {
  if (!overlayReady) return;
  if (!heroCenterRef.current || !heroTopRef.current) return;

  const center = heroCenterRef.current.getBoundingClientRect();
  const top = heroTopRef.current.getBoundingClientRect();

  // flyt word fra center-slot midtpunkt til top-slot midtpunkt
  const centerMidY = center.top + center.height / 2;
  const topMidY = top.top + top.height / 2;

  setHeroDeltaY(topMidY - centerMidY);
}, [overlayReady, slideIdx]);

// Reset slide flow when new result comes in
useEffect(() => {
  if (!result) return;
  if (!overlayReady) return;

  // ✅ lock “deck score” once per result
  const v = result?.overall ?? result?.pronunciation ?? result?.overallAccuracy ?? 0;
  const n = Number(v);
  const pct = Number.isFinite(n) ? (n <= 1 ? Math.round(n * 100) : Math.round(n)) : 0;
  const locked = Math.max(0, Math.min(100, pct));
  deckPctRef.current = locked;
  setDeckPctLocked(locked);

  setSlideIdx(0);
  setIntroPhase(-1);
  setIntroPct(0);

  clearIntroTimers();

  introTimersRef.current.push(setTimeout(() => setIntroPhase(0), 50));
  introTimersRef.current.push(setTimeout(() => setIntroPhase(1), 650));
  introTimersRef.current.push(setTimeout(() => setIntroPhase(2), 2100));
  introTimersRef.current.push(setTimeout(() => setIntroPhase(3), 2100 + 1500));
  introTimersRef.current.push(setTimeout(() => setIntroPhase(4), 2100 + 1500 + 520));

  return () => clearIntroTimers();
}, [result, overlayReady]);


// Reset/force introPct when leaving/returning to slide 1
useEffect(() => {
  if (!result) return;
  if (!overlayReady) return;


  if (slideIdx === 0) {
    clearIntroTimers();

    // when you come back to slide 1: restart its animation
        setIntroPct(0);
    setIntroPhase(-1);

const t0 = setTimeout(() => setIntroPhase(0), 50);
const t1 = setTimeout(() => setIntroPhase(1), 650);
const t2 = setTimeout(() => setIntroPhase(2), 2100);

// hold teksten ~3s
const t3 = setTimeout(() => setIntroPhase(3), 2100 + 1500);

// vent på fade (du bruger 520ms i CSS)
const t4 = setTimeout(() => setIntroPhase(4), 2100 + 1500 + 520);


return () => clearIntroTimers();


  } else {
    // when leaving slide 1: force it to final score so it never "sticks" mid-way
    setIntroPct(deckScore);
  }
}, [slideIdx, deckScore, result]);

// Count-up when introPhase hits 1
useEffect(() => {
  if (slideIdx !== 0) return;
  if (introPhase !== 1) return;

  const target = deckScore;

  let raf = 0;
  const start = performance.now();
  const dur = 1100;

  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    setIntroPct(Math.round(target * p));
    if (p < 1) raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [slideIdx, introPhase, deckScore]);

// Slide 2: animate the DOT up to the (same) introPct value
useEffect(() => {
  if (slideIdx !== 1) return;

  const target = Math.max(0, Math.min(100, Number(deckScore) || 0));
  const from = 0; // eller levelPctAnim hvis du vil “fortsætte” fra sidste
  setLevelPctAnim(0); // vigtigt: reset så den ikke arver gammel værdi

  let raf = 0;
  const start = performance.now();
  const dur = 1400;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const v = from + (target - from) * easeOutCubic(p);
    setLevelPctAnim(Math.round(v));
    if (p < 1) raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [slideIdx, deckScore]);




function stopLoopTimer() {
  if (loopTimerRef.current) {
    clearTimeout(loopTimerRef.current);
    loopTimerRef.current = null;
  }
}

function stopAllAudio() {
  stopLoopTimer();

  // stop server TTS audio
  stopTtsNow();

  try {
    if (userAudioRef.current) {
      userAudioRef.current.pause();
      userAudioRef.current.currentTime = 0;
    }
  } catch {}

  try {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch {}

  try {
    phonemeVideoRef.current?.pause();
  } catch {}
  setPhonemeVideoPlaying(false);
}

function stopTtsNow() {
  try { ttsAbortRef.current?.abort(); } catch {}
  ttsAbortRef.current = null;

  try {
    const a = ttsAudioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
      a.src = "";
    }
  } catch {}

  // revoke only non-cached url
  try { if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current); } catch {}
  ttsUrlRef.current = null;

  setIsCorrectPlaying(false);
}

async function ensureTtsUrl({ text, accent, rate }) {
  const t = String(text || "").trim();
  if (!t) throw new Error("Missing text");

  const key = `${accent}|${rate}|${t}`;
  const cached = ttsCacheRef.current.get(key);
  if (cached) return cached;

  const base = getApiBase();
  const controller = new AbortController();
  ttsAbortRef.current = controller;

  const r = await fetch(`${base}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({ text: t, accent, rate }),
  });

  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`TTS failed (${r.status}): ${msg || r.statusText}`);
  }

  const buf = await r.arrayBuffer();
  const blob = new Blob([buf], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);

  ttsCacheRef.current.set(key, url);
  return url;
}
async function prefetchTtsUrl({ text, accent, rate }) {
  const t = String(text || "").trim();
  if (!t) return null;

  const key = `${accent}|${rate}|${t}`;
  const cached = ttsCacheRef.current.get(key);
  if (cached) return cached;

  const base = getApiBase();

  // IMPORTANT: no ttsAbortRef here (so we don't cancel real plays)
  const r = await fetch(`${base}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: t, accent, rate }),
  });

  if (!r.ok) return null;

  const buf = await r.arrayBuffer();
  const blob = new Blob([buf], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);

  ttsCacheRef.current.set(key, url);
  return url;
}

async function playTtsUrl(url, { rate, loop }) {
  const a = ttsAudioRef.current;
  if (!a) return;

  const myPlayId = ++ttsPlayIdRef.current;

  // stop current first
  stopTtsNow();

  // if url is not cached, we track it in ttsUrlRef so it can be revoked
  // (here we assume url is cached; but keep the ref logic safe)
  ttsUrlRef.current = null;

  a.src = url;
  a.currentTime = 0;
  a.playbackRate = Number(rate ?? 1.0) || 1.0;

  setIsCorrectPlaying(true);

a.onended = () => {
  if (ttsPlayIdRef.current !== myPlayId) return;
  setIsCorrectPlaying(false);
  setDeepDivePlayingKey(null);

  if (loop) {
    loopTimerRef.current = setTimeout(async () => {
      if (ttsPlayIdRef.current !== myPlayId) return;
      try {
        a.currentTime = 0;
        a.playbackRate = Number(rate ?? 1.0) || 1.0;
        await a.play();
        setIsCorrectPlaying(true);
      } catch {}
    }, 220);
  }
};


  try {
    await a.play();
  } catch {
    setIsCorrectPlaying(false);
  }
}




function playYou() {
  stopAllAudio();
  const url = result?.userAudioUrl;
  if (!url) return;
  try {
    const a = new Audio(url);
    userAudioRef.current = a;
    a.playbackRate = playbackRate;
    a.play().catch(() => {});
    if (loopOn) {
      a.onended = () => {
        loopTimerRef.current = setTimeout(() => playYou(), 180);
      };
    }
  } catch {}
}

async function playCorrectTts() {
  stopAllAudio();

  const text = String(result?.refText || "").trim();
  if (!text) return;

  const accent = accentUi === "en_br" ? "en_br" : "en_us";
  const rate = Number(playbackRate ?? 1.0) || 1.0;

  // if already playing the same “correct”, pause/stop
  if (isCorrectPlaying) {
    stopTtsNow();
    return;
  }

  try {
    const url = await ensureTtsUrl({ text, accent, rate });
    await playTtsUrl(url, { rate, loop: loopOn });
  } catch (e) {
    if (!IS_PROD) setErr(e?.message || String(e));
    else setErr("TTS failed. Try again.");
  }
}



  // ---------------- Coach-like overlay state ----------------
  const [selectedWordIdx, setSelectedWordIdx] = useState(-1);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "phoneme"
  const [activePhonemeKey, setActivePhonemeKey] = useState(null); // e.g. "UW_3"
  const [videoMuted, setVideoMuted] = useState(true);
  const videoRef = useRef(null);

    const maxIdx = Math.max(0, (words?.length || 1) - 1);
  const safeWordIdx = selectedWordIdx < 0 ? -1 : Math.max(0, Math.min(selectedWordIdx, maxIdx));
  const currentWordObj = safeWordIdx >= 0 ? (words?.[safeWordIdx] || null) : null;

  const currentWordText = String(currentWordObj?.word || currentWordObj?.text || "").trim();
  const currentWordScore = getScore(currentWordObj);

  const phonemeLineItems = useMemo(() => {
    const ps = Array.isArray(currentWordObj?.phonemes) ? currentWordObj.phonemes : [];
    const out = [];

    const rawScores = ps.map(getScore).filter((x) => Number.isFinite(x));
    const wordScore = getScore(currentWordObj);

    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const code = getPhonemeCode(p);
      if (!code) continue;

      const raw = getScore(p);
      const s = normalizePhonemeScore(raw, wordScore, rawScores);

      const media = resolvePhonemeMedia(code);

      out.push({
        key: `${code}_${i}`,
        code,
        score: s,
        rawScore: raw,
      media,
hasMedia: !!media?.src,
        isWeak: s == null || !isGreen(s),
      });
    }

    return out;
  }, [currentWordObj]);

const weakItems = useMemo(
  () => phonemeLineItems.filter((x) => x.hasMedia && x.isWeak),
  [phonemeLineItems]
);


const activeWeakItem = useMemo(() => {
  if (!activePhonemeKey) return null;
  return weakItems.find((x) => x.key === activePhonemeKey) || null;
}, [weakItems, activePhonemeKey]);

  // auto-select first word when we get a result
  useEffect(() => {
    if (!result) return;
    if (words?.length && selectedWordIdx < 0) setSelectedWordIdx(0);
    setActiveTab("overview");
    setActivePhonemeKey(null);
    setVideoMuted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

useEffect(() => {
  if (!isPhonemeOverlay) return;
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.overflow = prev;
  };
}, [isPhonemeOverlay]);


  function disposeRecorder() {
    try {
      mediaRecRef.current?.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    mediaRecRef.current = null;
  }

  async function ensureMic() {
    disposeRecorder();
    if (!navigator?.mediaDevices?.getUserMedia) throw new Error("Microphone not supported on this device.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    let options = {};
    if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) options.mimeType = "audio/webm;codecs=opus";
      else if (MediaRecorder.isTypeSupported("audio/webm")) options.mimeType = "audio/webm";
      else if (MediaRecorder.isTypeSupported("audio/mp4")) options.mimeType = "audio/mp4";
    }

    let rec;
    try {
      rec = new MediaRecorder(stream, options);
    } catch {
      rec = new MediaRecorder(stream);
    }

    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e?.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => handleStop(rec);
    mediaRecRef.current = rec;
  }

  function handleStop(rec) {
    setIsRecording(false);

    const chunks = chunksRef.current.slice();
    chunksRef.current = [];

    disposeRecorder();
    try {
      if (lastUrl) URL.revokeObjectURL(lastUrl);
    } catch {}

    const type = chunks[0]?.type || rec?.mimeType || "audio/webm";
    const blob = new Blob(chunks, { type });

const localUrl = URL.createObjectURL(blob);
setLastUrl(localUrl);

// save for retry
lastAudioBlobRef.current = blob;
lastAudioUrlRef.current = localUrl;
setCanRetryAnalyze(false);

setIsAnalyzing(true);
sendToServer(blob, localUrl);

  }

  async function startPronunciationRecord() {
    if (!refText.trim()) {
        setTrophyCelebration(false);

      setErr("Type something first.");
      return;
    }
    try {
      setErr("");
      await ensureMic();
      chunksRef.current = [];
      mediaRecRef.current.start();
      setIsRecording(true);
      if (canPlaySfx) sfx.warm();
    } catch (e) {
      if (!IS_PROD) setErr("Microphone error: " + (e?.message || String(e)));
      else setErr("Microphone access is blocked. Please allow it and try again.");
      setIsRecording(false);
      if (canPlaySfx) sfx.softFail();
    }
  }

  function stopPronunciationRecord() {
    try {
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
    } catch {}
  }

  async function togglePronunciationRecord() {
    if (isRecording) stopPronunciationRecord();
    else if (!isAnalyzing) await startPronunciationRecord();
  }

  async function sendToServer(audioBlob, localUrl) {
    try {
      const text = sanitizeTextForSubmit(refText).slice(0, MAX_LEN);
      const base = getApiBase();

      const fd = new FormData();
      fd.append("audio", audioBlob, "clip.webm");
      fd.append("refText", text);
      fd.append("accent", accentUi === "en_br" ? "en_br" : "en_us");
fd.append("slack", String(settings?.slack ?? 0));

      
      // hard timeout
      const controller = new AbortController();
    const timeoutMs = 12000; // keep your value
const t = setTimeout(() => controller.abort(), timeoutMs);

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

        psm = psmSentenceScoreFromApi(json);
        json = { ...json, overall: psm.overall, pronunciation: psm.overall, overallAccuracy: psm.overall };
      } catch (e) {
        clearTimeout(t);
        if (e?.name === "AbortError") throw new Error("Analysis timed out. Please try again.");
        throw e;
      }

      const overall = Number(psm?.overall ?? json?.overall ?? 0);

      if (canPlaySfx) {
        if (overall >= 90) sfx.success({ strength: 2 });
        else if (overall >= 75) sfx.success({ strength: 1 });
      }

      const payload = {
        ...json,
        overall,
        pronunciation: overall,
        overallAccuracy: overall,
        psmWordScores: Array.isArray(psm?.wordScores) ? psm.wordScores : [],
        userAudioUrl: localUrl,
        userAudioBlob: audioBlob,
        refText: text,
        accent: accentUi,
        inlineMsg: pickFeedback({ ...json, overall }),
        createdAt: Date.now(),
      };

      setResult(payload);
setOverallPctLocked(Math.max(0, Math.min(100, Number(overall) || 0)));

const trophyReached = Number(payload.overall) >= TROPHY_REACHED_PCT;

if (trophyReached) {
  triggerTrophyCelebration();
}


try { sessionStorage.setItem(RESULT_KEY, JSON.stringify(payload)); } catch {}


  } catch (e) {
  const isAbort = e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("timed out");

  if (isAbort) {
    setErr("Analysis timed out. Tap retry and try again.");
    setCanRetryAnalyze(!!lastAudioBlobRef.current && !!lastAudioUrlRef.current);
  } else {
    if (!IS_PROD) setErr(e?.message || String(e));
    else setErr("Something went wrong. Try again.");
  }

  if (canPlaySfx) sfx.softFail();
} finally {
  setIsAnalyzing(false);
}

  }
useEffect(() => {
  if (!result) return;
  if (isBusy) return;

  const currentAccent = (result?.accent || "en_us");
  const nextAccent = (accentUi === "en_br" ? "en_br" : "en_us");
  if (currentAccent === nextAccent) return;

  const blob = lastAudioBlobRef.current || result?.userAudioBlob || null;
  const url  = lastAudioUrlRef.current  || result?.userAudioUrl  || null;
  if (!blob || !url) return;

  setErr("");
  setCanRetryAnalyze(false);
  setIsAnalyzing(true);
  sendToServer(blob, url);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [accentUi]);

const CloseSlidesX = ({ top = `calc(${SAFE_TOP} + 24px)`, right = "12px" }) => (
  <button
    type="button"
   onClick={() => {
  stopAllAudio();

  // ✅ hide overlay immediately (even if route transition keeps component mounted)
  setIsClosingSlides(true);

  // cleanup so it can't re-open
  try { sessionStorage.removeItem(RESULT_KEY); } catch {}
  setDeepDiveOpen(false);
  setDeepDivePhoneme(null);
  setSlideIdx(0);
  setIntroPhase(0);
  setIntroPct(0);
  setLevelPctAnim(0);
  setErr("");
  setCanRetryAnalyze(false);
  setResult(null);

  // ✅ navigate after overlay is hidden
  requestAnimationFrame(() => {
    nav(backRoute, { replace: true });
  });
}}

    aria-label="Close"
    style={{
      position: "absolute",
      top,
      right,
      width: 40,
      height: 40,
      borderRadius: 20,
      border: "1px solid rgba(11,18,32,0.10)",
      background: "rgba(11,18,32,0.04)",
      color: "#0B1220",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      zIndex: 10002,
    }}
  >
    <X className="h-5 w-5" />
  </button>
);



 return (
  <div
    className="page"
    style={{
      minHeight: "100dvh",
      width: "100%",
      background: PAGE_BG,
      color: PAGE_TEXT,
    }}
  >

     



      <div
        style={{
      maxWidth: "100%",
          margin: 0,
          padding: "0 16px",
          paddingBottom: `calc(${TABBAR_OFFSET}px + 24px + ${SAFE_BOTTOM})`,
        }}
      >
      {/* iOS-style header row */}
<div
  style={{
    position: "sticky",
    top: 0,
    zIndex: 20,
    paddingTop: `calc(${SAFE_TOP} + 14px)`,
    paddingBottom: 12,
    background: HEADER_BG,
color: HEADER_TEXT,
  }}
>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
    <button
      type="button"
      onClick={() => nav(backRoute)}
      aria-label="Back"
      style={{
        width: 44,
        height: 44,
        borderRadius: 16,
   border: `1px solid ${HEADER_BORDER}`,
background: HEADER_SURFACE,
boxShadow: PAGE_SHADOW,

        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        flex: "0 0 auto",
      }}
    >
      <ChevronLeft className="h-6 w-6" />
    </button>

    <div
      style={{
        fontSize: 28,
       fontWeight: 1000,
letterSpacing: -0.5,

        lineHeight: 1.1,
        textAlign: "center",
        flex: "1 1 auto",
      }}
    >
      {title}
    </div>

    <div style={{ position: "relative", flex: "0 0 auto" }}>
      <select
        aria-label="Accent"
        value={accentUi}
        onChange={(e) => !isBusy && setAccentUi(e.target.value)}
        disabled={isBusy}
        style={{
          height: 44,
          borderRadius: 16,
          padding: "0 12px",
          fontWeight: 900,
       color: HEADER_TEXT,
background: HEADER_SURFACE,
border: `1px solid ${HEADER_BORDER}`,
boxShadow: PAGE_SHADOW,

          outline: "none",
          cursor: isBusy ? "not-allowed" : "pointer",
          appearance: "none",
          paddingRight: 34,
        }}
        title="Accent"
      >
        <option value="en_us">🇺🇸</option>
        <option value="en_br">🇬🇧</option>
      </select>

      <ChevronDown
        className="h-4 w-4"
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: HEADER_MUTED,
          pointerEvents: "none",
        }}
      />
    </div>
  </div>
</div>

{/* Error + Retry (only after timeout) */}
{!!err && (
  <div
    style={{
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 14,
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.18)",
      color: "rgba(17,24,39,0.92)",
      fontWeight: 800,
      fontSize: 13,
      lineHeight: 1.35,
    }}
  >
    {err}
  </div>
)}

{canRetryAnalyze && !isAnalyzing && (
  <button
    type="button"
    onClick={() => {
      const b = lastAudioBlobRef.current;
      const u = lastAudioUrlRef.current;
      if (!b || !u) return;

      setErr("");
      setCanRetryAnalyze(false);
      setIsAnalyzing(true);
      sendToServer(b, u);
    }}
    style={{
      marginTop: 10,
      width: "100%",
      height: 46,
      borderRadius: 16,
      border: "none",
      background: "rgba(33,150,243,0.14)",
      fontWeight: 950,
      cursor: "pointer",
    }}
  >
    Retry analysis
  </button>
)}

{!!result && overlayReady && !isClosingSlides && (
  <div
    className="pmt-overlay"
    style={{
      position: "fixed",
      inset: 0,
      height: "100dvh",
      background:
        "radial-gradient(800px 420px at 50% 26%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.00) 62%), " +
        "radial-gradient(1200px 700px at 50% 15%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.00) 52%), " +
        "linear-gradient(180deg, #2F9AF2 0%, #2092EC 45%, #1B78D6 100%)",
      color: "white",
      zIndex: 9999,
      paddingTop: 0,
      paddingLeft: 24,
      paddingRight: 24,
      paddingBottom: `calc(14px + ${SAFE_BOTTOM})`,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <style>{`
      .pmt-overlay .pf-hero-word {
        font-size: inherit !important;
        line-height: inherit !important;
        font-weight: inherit !important;
      }
    `}</style>

 

  

    {/* Centered width like other pages */}
    <div
      style={{
            position: "relative", // ✅ gør CloseSlidesX (slide 1) relativ til denne bredde

        width: "100%",
    maxWidth: 760,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: "1 1 auto",
      }}
    >
{/* CONTENT */}
{(() => {
  const showChevrons = slideIdx !== 0 || introPhase >= 4;
  const CHEVRON_RESERVE_PX = 92; // nok til knapper + padding

  return (
    <div
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
position: "relative",
justifyContent: "flex-start",
        paddingTop: 0,

        // ✅ ingen bund-reserve før chevrons vises (så slide 1 faktisk er centreret)
        paddingBottom: showChevrons ? CHEVRON_RESERVE_PX : 0,
      }}
    >


{slideIdx === 0 ? (
  <>
    <CloseSlidesX top={`calc(${SAFE_TOP} + 24px)`} right="12px" />

{/* ABSOLUTE CENTER LAYER (ONLY HERO) */}
<div
style={{
  position: "absolute",
  inset: 0,
  display: "grid",

  // ✅ før phase 4: center
  // ✅ fra phase 4: flyt hele hero-blokken op under safe-top
  placeItems: introPhase >= 4 ? "start center" : "center",

  paddingLeft: 24,
  paddingRight: 24,
  paddingTop: introPhase >= 4 ? `calc(${SAFE_TOP} + 56px)` : 0,

  pointerEvents: "none",
}}

>
  <div
    style={{
      width: "100%",
      maxWidth: 720,
      margin: "0 auto",
      textAlign: "center",
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 28,
      paddingBottom: 28,
    }}
  >
    {/* CENTER STACK (matches screenshot) */}
    <div
  style={{
    position: "relative",
    width: "100%",
    maxWidth: 720,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",

    // ✅ less space between word and percent once percent is visible
    gap: introPhase >= 1 ? 2 : 10,

    // ✅ lift up slightly BEFORE final phase (phase 3), then a bit more in phase 4
    transform: "translateY(0px)",
    transition: "transform 900ms cubic-bezier(0.2, 0.9, 0.2, 1)",
  }}
>

      {/* subtle radial light BEHIND the percent */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "52%",
          transform: "translate(-50%, -50%)",
          width: 320,
          height: 190,
          borderRadius: 999,
          background:
            "radial-gradient(closest-side at 50% 55%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.10) 32%, rgba(255,255,255,0.00) 70%)",
          opacity: introPhase >= 1 ? 1 : 0,
          transition: "opacity 1500ms ease",
          transitionDelay: introPhase >= 1 ? "260ms" : "0ms",
          zIndex: 0,
        }}
      />



{/* Anchors: define the exact center slot + the exact top slot */}
<div
  ref={heroCenterRef}
  aria-hidden="true"
  style={{
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 1,
    height: 1,
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  }}
/>

<div
  ref={heroTopRef}
  aria-hidden="true"
  style={{
    position: "absolute",
    left: "50%",
    top: `calc(${SAFE_TOP} + 86px)`, // 👈 top destination for the WORD
    width: 1,
    height: 1,
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  }}
/>

{/* ONE WORD (same DOM node): starts centered, then glides up */}
<div
  style={{
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: `translate(-50%, -50%) translateY(${introPhase >= 1 ? heroDeltaY : 0}px)`,
    transition: "transform 1200ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 900ms ease",
    opacity: introPhase >= 0 ? 1 : 0,
    zIndex: 1,
    width: "100%",
    paddingLeft: 16,
    paddingRight: 16,
    pointerEvents: "none",
  }}
>
  <div
    style={{
      fontWeight: 1000,
  fontSize: Math.round(computePctFontSize(heroText, 112, 68) * 0.95),

      lineHeight: 1.05,
      letterSpacing: -0.4,
      WebkitTextStroke: "1.25px rgba(0,0,0,0.20)",
      paintOrder: "stroke fill",
      display: "inline-block",
      maxWidth: "100%",
    }}
  >
    <PhonemeFeedback result={result} mode="textOnly" />

<div
  style={{
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: `translate(-50%, -50%) translateY(${introPhase === 2 ? 78 : 70}px)`,
    fontWeight: 850,
    fontSize: 32, // ✅ bigger
    color: "rgba(255,255,255,0.88)",
    opacity: introPhase === 2 ? 1 : 0,
    transition: "opacity 520ms ease, transform 520ms ease",
    zIndex: 2, // ✅ above the % if they ever touch
    pointerEvents: "none",
    textAlign: "center",
    whiteSpace: "nowrap",
  }}
>
  {pickShortLineFromScore(deckPctLocked)}
</div>

  </div>
</div>

{/* ONE PERCENT: appears exactly where the word used to be (center slot) */}
<div
  style={{
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    opacity: introPhase >= 1 ? 1 : 0,
    transition: "opacity 900ms ease",
    transitionDelay: introPhase >= 1 ? "220ms" : "0ms",
    fontWeight: 1000,
    fontSize: computePctFontSize(heroText, 112, 68),
    lineHeight: 1,
    letterSpacing: -1.1,
    color: pfColorForPct(deckPctLocked),
    WebkitTextStroke: "1.5px rgba(0,0,0,0.20)",
    paintOrder: "stroke fill",
    zIndex: 1,
    pointerEvents: "none",
  }}
>
  {introPct}%
</div>

    </div>
  </div>
</div>

{/* DETAILS LAYER (does NOT affect hero centering) */}
<div
  style={{
    position: "absolute",
    left: 0,
    right: 0,

    // ✅ sits below the center, without shifting it
 top: introPhase >= 4 ? `calc(${SAFE_TOP} + 240px)` : "calc(50% + 120px)",
transform: introPhase >= 4 ? "translateY(0px)" : "translateY(-20px)",

// ✅ vigtig: hold details væk fra chevrons-området
bottom: introPhase >= 4 ? `${CHEVRON_RESERVE_PX}px` : "auto",
overflow: introPhase >= 4 ? "auto" : "visible",
WebkitOverflowScrolling: introPhase >= 4 ? "touch" : "auto",


    opacity: introPhase >= 4 ? 1 : 0,
    transition: "opacity 700ms ease, transform 700ms ease",
    pointerEvents: introPhase >= 4 ? "auto" : "none",

    paddingLeft: 16,
    paddingRight: 16,
  }}
>
  {/* Coach / You */}
  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
    <button
      type="button"
      onClick={playCorrectTts}
      style={{
        flex: "0 0 auto",
        minWidth: 150,
        height: 48,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(255,255,255,0.10)",
        color: "rgba(255,255,255,0.92)",
        fontWeight: 950,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <Volume2 className="h-5 w-5" />
      Coach
    </button>

    <button
      type="button"
      onClick={playYou}
      style={{
        flex: "0 0 auto",
        minWidth: 150,
        height: 48,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(255,255,255,0.10)",
        color: "rgba(255,255,255,0.92)",
        fontWeight: 950,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <Volume2 className="h-5 w-5" />
      You
    </button>
  </div>

  {/* Phoneme list */}
  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
    {(weakPhonemeSlides || []).map((p) => {
      const pct = p?.score == null ? null : Math.round(Number(p.score));
      return (
        <div
          key={`intro_row_${p.code}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <button
            type="button"
            onClick={() => playDeepDiveTts(p.code, `intro_ph:${p.code}`)}
            aria-label={`Play ${p.code}`}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(0,0,0,0.18)",
              color: "rgba(255,255,255,0.92)",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              flex: "0 0 auto",
            }}
          >
            <Volume2 className="h-5 w-5" />
          </button>

          <div
            style={{
              fontWeight: 1000,
              letterSpacing: -0.4,
              fontSize: 18,
              color: "rgba(255,255,255,0.92)",
              flex: "1 1 auto",
              textAlign: "left",
            }}
          >
            {p.code}
          </div>

          <div
            style={{
              fontWeight: 1000,
              letterSpacing: -0.4,
              fontSize: 16,
              color: pct == null ? "rgba(255,255,255,0.55)" : pfColorForPct(pct),
              WebkitTextStroke: pct == null ? "0px" : "1px rgba(0,0,0,0.18)",
              paintOrder: "stroke fill",
              flex: "0 0 auto",
            }}
          >
            {pct == null ? "—" : `${pct}%`}
          </div>
        </div>
      );
    })}
  </div>
</div>


    </>
) : slideIdx === 1 ? (
  // ----- Speech Level (SLIDE 2 – MATCH IMAGE 2) -----
  (() => {
   const tracked = deckScore;

const LEVELS = ["Native", "Proficient", "Advanced", "Intermediate", "Beginner", "Novice"];
const n = LEVELS.length;

// Baren: lidt højere/opad + ekstra plads for 🏆 + 3 ticks over første dot
const LADDER_H = 520;

// hvor højt 🏆 sidder inde i baren (lavere tal = mindre luft over 🏆)
const TROPHY_TOP = 14;

// før var trophy top = 52, så vi “trimmer” 34px af top-luften
const TOP_TRIM = 52 - TROPHY_TOP;

// flyt hele baren NED med samme trim, så 🏆 ender samme sted på skærmen
const STACK_TOP = `calc(${SAFE_TOP} + 44px + ${TOP_TRIM}px)`;

// flyt skalaen (ticks/dots) OP tilsvarende, så den også ender samme sted på skærmen
const SCALE_TOP_PAD = 64 - TOP_TRIM; // = 30

const SCALE_BOTTOM_PAD = 26;

const usableH = LADDER_H - SCALE_TOP_PAD - SCALE_BOTTOM_PAD;

function yForLevel(i) {
  // i = 0..n-1 (Native..Novice)
  return SCALE_TOP_PAD + (usableH * (i / (n - 1)));
}
function yForPct(pct) {
  const p = clamp(Number(pct) || 0, 0, 100);
  // 100 => top, 0 => bottom
  return SCALE_TOP_PAD + (usableH * ((100 - p) / 100));
}

// 100 = Native (top), 0 = Novice (bund)
const idx = clamp(Math.round(((100 - tracked) / 100) * (n - 1)), 0, n - 1);
const dotTopPx = yForPct(levelPctAnim);
const BUBBLE_H = 58; // ca. højde på boblen
const BUBBLE_NUDGE_UP = 5; // 👈 tiny tweak (mere op)
const bubbleTop = clamp(dotTopPx - BUBBLE_H / 2 - BUBBLE_NUDGE_UP, -6, LADDER_H - BUBBLE_H + 8);



  return (
  <div
    style={{
      position: "relative",
      flex: "1 1 auto",
      minHeight: 0,
      height: "100%",
      paddingTop: `calc(${SAFE_TOP} + 22px)`,
      paddingLeft: 24,
      paddingRight: 24,
    }}
  >
    <CloseSlidesX top={`calc(${SAFE_TOP} + 24px)`} right="12px" />

    {/* LEFT TITLE (top-left) */}

        <div
          style={{
            position: "absolute",
            left: 22,
            top: `calc(${SAFE_TOP} + 40px)`,
            fontSize: 36,
            fontWeight: 950,
            lineHeight: 1.02,
            letterSpacing: -0.6,
            maxWidth: 240,
          }}
        >
          Your
          <br />
          Speaking
          <br />
          Level
        </div>

        {/* RIGHT STACK (ladder + labels) */}
  <div
  style={{
    position: "absolute",
    right: -8, // 👈 mere til højre (tættere på kanten)
    top: `calc(${SAFE_TOP} + 140px)`, // 👈 markant længere ned
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  }}
>


          {/* LADDER */}
          <div
            style={{
              position: "relative",
      height: LADDER_H,
width: 54,
borderRadius: 30,
              background: "rgba(11,18,32,0.22)", // dark translucent like image 2
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 18px 46px rgba(0,0,0,0.22)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
       {/* Trophy (no badge background) */}
<div
  style={{
    position: "absolute",
    top: TROPHY_TOP,
    left: "50%",
    transform: "translateX(-50%)",
    background: "transparent",
    border: "none",
    fontSize: 16,
    lineHeight: 1,
    opacity: 0.98,
    pointerEvents: "none",
  }}
>
  🏆
</div>


           {/* 3 ticks between each level dot (like ref) */}
{/* 3 ticks mellem hver level — ens spacing i alle segments */}
{Array.from({ length: n - 1 }).flatMap((_, seg) => {
  const yA = yForLevel(seg);
  const yB = yForLevel(seg + 1);

  return [1, 2, 3].map((k) => {
    const t = k / 4; // 3 ticks => 1/4, 2/4, 3/4
    const y = yA + (yB - yA) * t;

    return (
      <div
        key={`tick_${seg}_${k}`}
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          top: `${y - 1}px`,
        width: 10,
height: 2,
          borderRadius: 999,
          background: "rgba(255,255,255,0.22)",
        }}
      />
    );
  });
})}



            {/* level dots */}
{/* level dots (no Native dot at top) */}
{LEVELS.map((_, i) => {
  if (i === 0) return null;

  const y = yForLevel(i);
  const active = i === idx;

  const size = active ? 12 : 8;
  const r = size / 2;

  return (
    <div
      key={`dot_${i}`}
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        top: `${y - r}px`,
        width: size,
        height: size,
        borderRadius: r,
        background: "rgba(255,255,255,0.92)",
        opacity: active ? 1 : 0.55,
        boxShadow: active ? "0 10px 22px rgba(0,0,0,0.20)" : "none",
      }}
    />
  );
})}


            {/* speech bubble (left of ladder) */}
        <div
  style={{
    position: "absolute",
    left: -104,            // 👈 lidt mere mod højre
top: `${bubbleTop}px`,
                background: "rgba(255,255,255,0.96)",
                color: "#0B1220",
               borderRadius: 16,
padding: "10px 12px",
                fontWeight: 950,
                boxShadow: "0 18px 46px rgba(0,0,0,0.22)",
minWidth: 118,
              }}
            >
             <div style={{ color: "#fb923c", fontSize: 22, lineHeight: 1.0 }}>You</div>
<div style={{ fontSize: 22, lineHeight: 1.0 }}>{levelPctAnim}%</div>


              {/* bubble pointer */}
              <div
                style={{
                  position: "absolute",
                  right: -7,
                  top: "50%",
                  transform: "translateY(-50%) rotate(45deg)",
                width: 12,
height: 12,

                  background: "rgba(255,255,255,0.96)",
                }}
              />
            </div>
          </div>

         {/* RIGHT LABELS (absolute positioned to align exactly with dots) */}
<div
  style={{
    position: "relative",
    height: LADDER_H,
    minWidth: 106,
    fontWeight: 850,
fontSize: 14,
    letterSpacing: -0.2,
    opacity: 0.78,
    color: "rgba(255,255,255,0.92)",
  }}
>
  {LEVELS.map((l, i) => (
    <div
      key={l}
      style={{
        position: "absolute",
        top: `${yForLevel(i)}px`,
        transform: "translateY(-50%)",
        left: 0,
        whiteSpace: "nowrap",
      }}
    >
      {l}
    </div>
  ))}
</div>

        </div>
      </div>
    );
  })()



  ) : slideIdx >= 2 && slideIdx <= 1 + weakPhonemeSlides.length ? (
    // ----- Phoneme slides -----
    (() => {
      const s = weakPhonemeSlides[slideIdx - 2];
      if (!s) return null;

      return (
        <>
         <div
  style={{
    position: "relative",
background: "#FFFFFF",
    color: "#0B1220",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: `calc(${SAFE_TOP} + 18px)`,
    paddingLeft: 22,
    paddingRight: 72, // plads til X
    paddingBottom: 18,
    boxShadow: "0 18px 40px rgba(0,0,0,0.12)",
    marginBottom: 22,

    marginLeft: -24,
marginRight: -24,

  }}
>
 <CloseSlidesX />


  <div style={{ fontSize: 42, fontWeight: 950, letterSpacing: -0.5, lineHeight: 1.05 }}>
    {s.code} Sound
  </div>

  <div style={{ marginTop: 8, color: "rgba(11,18,32,0.60)", fontWeight: 650, lineHeight: 1.35, fontSize: 16 }}>
    {getShortTipForPhoneme(s.code)}
  </div>
</div>


          <div
            style={{
              marginTop: 28,
              
              width: "100%",
              marginLeft: "auto",
              marginRight: "auto",
              borderRadius: 28,
              overflow: "hidden",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            {s.mediaKind === "image" ? (
              <img src={s.mediaSrc} alt={`${s.code} visual`} style={{ width: "100%", display: "block" }} />
            ) : (
        <div style={{ position: "relative" }}>
  <video
    key={s.mediaSrc}
    ref={phonemeVideoRef}
    src={s.mediaSrc}
    poster={`/phonemes/Videos/${s.code}.jpg`}
    playsInline
    muted={false}
    controls={false}
    loop={false}
    autoPlay={false}
    preload="auto"
    style={{ width: "100%", display: "block" }}
    onEnded={() => setPhonemeVideoPlaying(false)}
  />

  {/* ✅ darker overlay (only when NOT playing) */}
  <div
    aria-hidden="true"
    style={{
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(180deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.34) 100%)",
      opacity: phonemeVideoPlaying ? 0 : 1,
      transition: "opacity 220ms ease",
      pointerEvents: "none",
    }}
  />

  <button
    type="button"
    onClick={async () => {
      const v = phonemeVideoRef.current;
      if (!v) return;

      try {
        if (v.paused) {
          v.muted = false;
          v.currentTime = 0;
          await v.play();
          setPhonemeVideoPlaying(true);
        } else {
          v.pause();
          setPhonemeVideoPlaying(false);
        }
      } catch {}
    }}
    aria-label={phonemeVideoPlaying ? "Pause video" : "Play video"}
    style={{
      position: "absolute",
      inset: 0,
      display: "grid",
      placeItems: "center",
      background: "transparent",
      border: "none",
      cursor: "pointer",
    }}
  >
    <div
      style={{
        width: 76,
        height: 76,
        borderRadius: 38,
        background: "rgba(0,0,0,0.46)", // ✅ darker
        border: "1px solid rgba(255,255,255,0.28)",
        display: "grid",
        placeItems: "center",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow:
          "0 22px 60px rgba(0,0,0,0.45), 0 0 0 6px rgba(255,255,255,0.06)", // ✅ subtle glow ring
        transform: phonemeVideoPlaying ? "scale(0.96)" : "scale(1)",
        transition: "transform 180ms ease",
      }}
    >
      {phonemeVideoPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
    </div>
  </button>
</div>


            )}
          </div>

         <div style={{ marginTop: 16 }}>
  <button
    type="button"
    onClick={() => {
      setDeepDivePhoneme({ code: s.code, letters: s.letters, score: s.score });
      setDeepDiveOpen(true);
    }}
    style={{
      width: "100%",
      height: 56,
      borderRadius: 20,
      border: "none",
     background: "#ffffff",
color: "#0B1220",
      fontWeight: 900,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    }}
   >
    Watch Detailed Guide <span style={{ fontSize: 20, lineHeight: 0 }}>→</span>
  </button>

</div>

        </>
      );
    })()
  ) : slideIdx === 2 + weakPhonemeSlides.length ? (
    // ----- Playback slide -----
   <>
  {/* White header card */}
<div
  style={{
    position: "relative",
background: "#E8F2FF",
    color: "#0B1220",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: `calc(${SAFE_TOP} + 18px)`,
    paddingLeft: 22,
    paddingRight: 72, // plads til X
    paddingBottom: 18,
    boxShadow: "0 18px 40px rgba(0,0,0,0.12)",
    marginBottom: 22,

    marginLeft: -16,
marginRight: -16,

  }}
>
  <CloseSlidesX />

  <div
    style={{
      fontSize: 34,
      fontWeight: 950,
      letterSpacing: -0.5,
      lineHeight: 1.05,
    }}
  >
    Playback
  </div>


    <div
      style={{
        marginTop: 10,
        color: "rgba(11,18,32,0.60)",
        fontWeight: 650,
        lineHeight: 1.35,
        fontSize: 16,
      }}
    >
      Listen to your attempt vs a correct reference.
    </div>
  </div>


<div
  style={{
    marginTop: 22,
    display: "grid",
    gap: 10,
  }}
>
  <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={playYou}
            style={{
              flex: 1,
height: 56,
              borderRadius: 16,
              border: "none",
           background: "#ffffff",
color: "#0B1220",
fontSize: 16,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Play You
          </button>

          <button
            type="button"
            onClick={playCorrectTts}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 16,
              border: "none",
           background: "#ffffff",
color: "#0B1220",

              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Play Correct
          </button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "1.00", v: 1.0 },
            { label: "0.85", v: 0.85 },
            { label: "0.75", v: 0.75 },
          ].map((x) => {
            const active = Math.abs(playbackRate - x.v) < 0.001;
            return (
              <button
                key={x.label}
                type="button"
                onClick={() => setPlaybackRate(x.v)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 14,
                border: "1px solid rgba(11,18,32,0.12)",
background: "#ffffff",
color: "#0B1220",

                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {x.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setLoopOn((v) => !v)}
            style={{
              width: 96,
              height: 44,
              borderRadius: 14,
             border: "1px solid rgba(11,18,32,0.12)",
background: "#ffffff",
color: "#0B1220",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Loop
          </button>
        </div>
      </div>

      <div style={{ marginTop: "auto" }} />
    </>
  ) : (
    // ----- Actions slide -----
    <>
  <div
  style={{
    position: "relative",
background: "#E8F2FF",
    color: "#0B1220",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: `calc(${SAFE_TOP} + 18px)`,
    paddingLeft: 22,
    paddingRight: 72, // plads til X
    paddingBottom: 18,
    boxShadow: "0 18px 40px rgba(0,0,0,0.12)",
    marginBottom: 22,

    marginLeft: -16,
marginRight: -16,

  }}
>
  <CloseSlidesX />

  <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: -0.5, lineHeight: 1.05 }}>
    Next
  </div>


  <div style={{ marginTop: 10, color: "rgba(11,18,32,0.60)", fontWeight: 650, lineHeight: 1.35, fontSize: 16 }}>
    Want another attempt or go back?
  </div>
</div>


      <div
        style={{
          marginTop: 22,
          display: "grid",
          gap: 10,
        }}
      >
        <button
          type="button"
         onClick={() => {
  stopAllAudio();

  const text = sanitizeTextForSubmit(result?.refText ?? refText).slice(0, MAX_LEN);
  const payload = {
    mode,                 // "coach" | "practice"
    backRoute,            // "/coach" | "/practice" (eller hvad du sender ind)
    refText: text,
    accent: accentUi,     // "en_us" | "en_br"
    ts: Date.now(),
  };

  try { sessionStorage.setItem(RETRY_INTENT_KEY, JSON.stringify(payload)); } catch {}

  // gå tilbage til origin siden og lad den auto-starte
  nav(backRoute, {
    replace: true,
    state: {
      ...(location?.state || {}),
      tryAgain: true,
      ...payload,
    },
  });
}}

          style={{
  height: 56,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
}}

        >
          <RotateCcw className="h-5 w-5" />
          Try again
        </button>

        <button
          type="button"
        onClick={async () => {
  stopAllAudio();

  // ✅ Coach-mode: returnér til /coach og bed den åbne live mic view (billede 2)
  if (mode === "coach") {
    nav("/coach", {
      replace: true,
      state: {
        ...(location.state || {}),
        autoStart: true,
      },
    });
    return;
  }

  // Practice-mode: bliv her og optag igen
  setResult(null);
  setTrophyCelebration(false);
  setErr("");
  setSlideIdx(0);
  setIntroPhase(0);
  setIntroPct(0);
  try {
    await startPronunciationRecord();
  } catch {}
}}

          style={{
            height: 56,
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Back to Menu
        </button>
      </div>

      <div style={{ marginTop: "auto" }} />
    </>
  )}
</div>
  );
})()}




    {/* Chevrons (bottom) — show only after intro is in final phase on slide 1 */}
{/* Chevrons (bottom) */}
{(slideIdx !== 0 || introPhase >= 4) && (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 20,

      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: 12,
      paddingRight: 12,
      paddingBottom: `calc(10px + ${SAFE_BOTTOM})`,
    }}
  >
    <button
      type="button"
      onClick={() => {
        stopAllAudio();
        goPrev();
      }}
      disabled={slideIdx <= 0}
      aria-label="Previous"
      style={{
        width: 52,
        height: 52,
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.08)",
        display: "grid",
        placeItems: "center",
        cursor: slideIdx <= 0 ? "not-allowed" : "pointer",
        opacity: slideIdx <= 0 ? 0.45 : 1,
      }}
    >
      <ChevronLeft className="h-6 w-6" />
    </button>

    <div
      style={{
        fontWeight: 950,
        fontSize: 16,
        letterSpacing: -0.2,
        color: "#ffffff",
      }}
    >
      {slideIdx + 1} / {totalSlides}
    </div>

    <button
      type="button"
      onClick={() => {
        stopAllAudio();
        goNext();
      }}
      disabled={slideIdx >= totalSlides - 1}
      aria-label="Next"
      style={{
        width: 64,
        height: 64,
        borderRadius: 24,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.08)",
        display: "grid",
        placeItems: "center",
        cursor: slideIdx >= totalSlides - 1 ? "not-allowed" : "pointer",
        opacity: slideIdx >= totalSlides - 1 ? 0.45 : 1,
      }}
    >
      <ChevronRight className="h-6 w-6" />
    </button>
  </div>
)}


    </div>
  </div>
)}






      </div>
      {deepDiveOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      height: "100dvh",
      background: "#0B1220",
      color: "white",
      zIndex: 10000,
      paddingTop: `calc(${SAFE_TOP} + 14px)`,
      paddingLeft: 18,
      paddingRight: 18,
paddingBottom: (slideIdx === 0 && introPhase < 4) ? 0 : `calc(14px + ${SAFE_BOTTOM})`,
overflow: "auto",
WebkitOverflowScrolling: "touch",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <button
      type="button"
      onClick={() => setDeepDiveOpen(false)}
      aria-label="Close deep dive"
      style={{
        position: "absolute",
      top: `calc(${SAFE_TOP} + 24px)`,
        right: 14,
        width: 44,
        height: 44,
        borderRadius: 22,
        border: "none",
        background: "rgba(255,255,255,0.10)",
        color: "white",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
      }}
    >
      <X className="h-5 w-5" />
    </button>

    <div style={{ paddingRight: 60 }}>
  <div style={{ fontSize: 30, fontWeight: 950, letterSpacing: -0.4 }}>{title}</div>

  <div style={{ marginTop: 6, color: "rgba(255,255,255,0.72)", fontWeight: 650 }}>
    {deepDivePhoneme?.code || "—"} • Score{" "}
{deepDivePhoneme?.score == null ? "—" : Math.round(deepDivePhoneme.score)}%  </div>
</div>


   {(() => {
  const code = String(deepDivePhoneme?.code || "").toUpperCase();
  const dd = getDeepDiveForPhoneme(code);

  const Section = ({ title, children }) => (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 950, color: "rgba(255,255,255,0.92)", fontSize: 14, letterSpacing: -0.2 }}>
        {title}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );

  const PlayBtn = ({ onClick, active }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 44,
        height: 44,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.12)",
        background: active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
        color: "white",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
      }}
      aria-label={active ? "Pause" : "Play"}
    >
      {active ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
    </button>
  );

  const Chip = ({ text, playKeyPrefix }) => {
    const k = `${playKeyPrefix}:${text}`;
    const active = deepDivePlayingKey === k && isCorrectPlaying;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 12px",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ fontWeight: 950, color: "rgba(255,255,255,0.92)", letterSpacing: -0.2 }}>{text}</div>
        <PlayBtn onClick={() => playDeepDiveTts(text, k)} active={active} />
      </div>
    );
  };

  const PairRow = ({ a, b, idx }) => {
    const ka = `pair:${idx}:a:${a}`;
    const kb = `pair:${idx}:b:${b}`;
    const activeA = deepDivePlayingKey === ka && isCorrectPlaying;
    const activeB = deepDivePlayingKey === kb && isCorrectPlaying;

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ fontWeight: 950, color: "rgba(255,255,255,0.92)" }}>{a}</div>
          <PlayBtn onClick={() => playDeepDiveTts(a, ka)} active={activeA} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ fontWeight: 950, color: "rgba(255,255,255,0.92)" }}>{b}</div>
          <PlayBtn onClick={() => playDeepDiveTts(b, kb)} active={activeB} />
        </div>
      </div>
    );
  };

  const emptyStyle = {
    padding: "12px 12px",
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.72)",
    fontWeight: 750,
    lineHeight: 1.35,
  };

  return (
    <div>
{/* Minimal pairs / Contrast:
    - Only show if this phoneme has a confusable partner.
    - If no partner: start directly at Example words (no section at all).
*/}
{(() => {
  const partner = getConfusablePartner(code);
  if (!partner) return null;

  const title = dd?.contrastLabel || `${code} vs ${partner}`;

  return (
    <Section title={title}>
      {dd?.minimalPairs?.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          {dd.minimalPairs.map(([a, b], i) => (
            <PairRow key={`${a}_${b}_${i}`} a={a} b={b} idx={i} />
          ))}
        </div>
      ) : (
        <div style={emptyStyle}>
          No minimal pairs added yet for {title}.
        </div>
      )}
    </Section>
  );
})()}



      {/* Example words by position */}
      <Section title="Example words (start / middle / end)">
        {(dd.positions?.start?.length || dd.positions?.mid?.length || dd.positions?.end?.length) ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 950, color: "rgba(255,255,255,0.86)", fontSize: 13 }}>Start</div>
              <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
                {(dd.positions?.start || []).map((w) => (
                  <Chip key={`start_${w}`} text={w} playKeyPrefix={`pos:start`} />
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 950, color: "rgba(255,255,255,0.86)", fontSize: 13 }}>Middle</div>
              <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
                {(dd.positions?.mid || []).map((w) => (
                  <Chip key={`mid_${w}`} text={w} playKeyPrefix={`pos:mid`} />
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 950, color: "rgba(255,255,255,0.86)", fontSize: 13 }}>End</div>
              <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
                {(dd.positions?.end || []).map((w) => (
                  <Chip key={`end_${w}`} text={w} playKeyPrefix={`pos:end`} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={emptyStyle}>No position-based word examples added for {code} yet.</div>
        )}
      </Section>

      {/* Sentence drills */}
      <Section title="Sentence drills">
        {dd.drills?.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {dd.drills.map((s, i) => (
              <Chip key={`drill_${i}`} text={s} playKeyPrefix="drill" />
            ))}
          </div>
        ) : (
          <div style={emptyStyle}>No sentence drills added for {code} yet.</div>
        )}
      </Section>

      <div style={{ height: 10 }} />
    </div>
  );
})()}

  </div>
)}
<audio ref={ttsAudioRef} playsInline preload="auto" />

    </div>
  );
}