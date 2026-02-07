// src/pages/Coach.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Mic, StopCircle, Volume2, Play, Pause } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useSettings } from "../lib/settings-store.jsx";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";
import { ingestLocalPhonemeScores } from "../lib/localPhonemeStats.js";
import PHONEME_EXAMPLES from "../data/phonemeExamples.json";
import { createPortal } from "react-dom";

// -------- Phoneme coaching tips (deterministic, not guessing) --------
// We only show tips for phonemes we have assets for (you already gate that).
// This does NOT claim what the user did wrong — it gives the best known technique
// for the primary weak phoneme (lowest score) and the selected phoneme.
const PHONEME_TIPS = {
  // vowels
  AA: { tryThis: "Open the jaw more and keep the tongue low and relaxed." },
  AH: { tryThis: "Keep the tongue central and relaxed; avoid over-rounding the lips." },
  AO: { tryThis: "Round the lips slightly and keep the tongue back; don’t spread into a smile." },
  AX: { tryThis: "Make it quick and relaxed (schwa) — don’t fully form a strong vowel." },
  EH: { tryThis: "Tongue mid-front and jaw slightly open; avoid sliding toward AY." },
  EY: { tryThis: "Start at EH and glide slightly upward; keep it controlled, not too long." },
  IH: { tryThis: "Tongue high-front but relaxed; don’t tense into IY." },
  IX: { tryThis: "Keep it very relaxed (like a reduced IH); avoid full vowel shaping." },
  IY: { tryThis: "Smile slightly and lift tongue high-front; keep it steady, not diphthong." },
  OH: { tryThis: "Round lips and keep tongue mid-back; avoid turning it into OW glide." },
  OY: { tryThis: "Start rounded (O) then glide to IY; keep the glide clear." },
  UH: { tryThis: "Keep lips relaxed and tongue high-back; don’t round too much." },
  UW: { tryThis: "Round lips more and keep tongue high-back; avoid fronting into 'oo' too forward." },
  UX: { tryThis: "Short, reduced UW — keep it quick and not fully rounded." },

  // consonants
  B: { tryThis: "Close both lips fully, build pressure, then release cleanly." },
  CH: { tryThis: "Start like T (stop), then release into SH — keep it crisp." },
  D: { tryThis: "Tongue tip to the ridge behind top teeth, then release quickly." },
  DH: { tryThis: "Place tongue lightly between teeth; keep voicing on (buzz)." },
  F: { tryThis: "Top teeth lightly on lower lip; push air continuously (no voicing)." },
  G: { tryThis: "Back of tongue to soft palate, build pressure, release cleanly." },
  HH: { tryThis: "Just airflow from the throat; don’t add a vowel before it." },
  JH: { tryThis: "Like CH but voiced — keep a gentle buzz while releasing." },
  K: { tryThis: "Back of tongue seals at soft palate; release with a clean burst of air." },
  L: { tryThis: "Tongue tip up to ridge; keep airflow around sides (don’t stop airflow)." },
  M: { tryThis: "Close lips and keep voicing; feel vibration in the nose." },
  N: { tryThis: "Tongue tip up; keep voicing and let air go through the nose." },
  P: { tryThis: "Close lips fully, build pressure, release with a stronger puff (aspiration)." },
  R: { tryThis: "Curl or bunch tongue without touching; keep lips slightly rounded." },
  SH: { tryThis: "Tongue slightly back with a narrow groove; steady airflow (no voicing)." },
  T: { tryThis: "Tongue tip to ridge; release cleanly with a light puff (especially in stressed syllables)." },
  TH: { tryThis: "Tongue between teeth; steady airflow; no voicing (unlike DH)." },
  V: { tryThis: "Top teeth on lower lip with voicing (buzz) — keep airflow continuous." },
  W: { tryThis: "Round lips and move quickly into the next vowel; don’t hold it too long." },
  ZH: { tryThis: "Like SH but voiced — keep a gentle buzz with steady airflow." },
};

// -------- What to listen for (NOT repeating tips) --------
// Short acoustic cues (not articulation instructions).
const PHONEME_LISTEN_FOR = {
  // vowels
  AA: "a wide open, steady vowel (no glide).",
  AH: "a relaxed, neutral vowel (not too bright).",
  AO: "rounded vowel quality (darker tone).",
  AX: "very quick, reduced vowel (don’t hold it).",
  EH: "clean mid-front vowel (avoid drifting into AY).",
  EY: "a clear glide: EH → higher (don’t flatten).",
  IH: "short, slightly relaxed vowel (not IY).",
  IX: "very reduced/quick version of IH.",
  IY: "bright, steady vowel (don’t diphthong).",
  OH: "rounded vowel with a stable center (no OW glide).",
  OY: "distinct two-part glide (O → IY).",
  UH: "short back-ish vowel (not fully rounded).",
  UW: "rounded ‘oo’ with a darker tone (not fronted).",
  UX: "quick reduced UW (very short).",

  // consonants
  B: "a clean stop release with voicing (no extra vowel).",
  CH: "a crisp ‘tch’ burst (not SH).",
  D: "a clean release (no added schwa).",
  DH: "a voiced ‘th’ buzz (not D).",
  F: "clean air noise (no voicing buzz).",
  G: "a firm back-stop release (clean burst).",
  HH: "pure breathy onset (no vowel before it).",
  JH: "a voiced ‘j’ quality (buzz + crisp release).",
  K: "a clean burst (avoid a harsh extra vowel).",
  L: "a clear L tone (not swallowed).",
  M: "a steady nasal hum (no stop).",
  N: "a steady nasal tone (don’t turn into D).",
  P: "a strong puff of air (aspiration).",
  R: "a smooth ‘r’ color (no L-like sound).",
  SH: "smooth, steady hiss (not CH).",
  T: "a clean ‘t’ burst (avoid extra vowel).",
  TH: "unvoiced ‘th’ air (no buzz).",
  V: "voiced buzz + friction (not F).",
  W: "rounded onset that quickly blends into the vowel.",
  ZH: "voiced ‘zh’ buzz (like ‘vision’).",
};

const PHONEME_UI_COPY = {
  // vowels
  AO: { title: "AO Sound", desc: "Round your lips gently. Keep the tongue back and low-mid. Hold it steady (no glide)." },
  OH: { title: "OH Sound", desc: "Round your lips and keep the tongue mid-back. Keep it stable (avoid turning it into OW)." },
  AA: { title: "AA Sound", desc: "Open your jaw more. Keep the tongue low and relaxed. Let the sound be wide and steady." },
  IX: { title: "IX Sound", desc: "A very reduced vowel. Keep everything relaxed and quick—don’t form a strong vowel shape." },
  IY: { title: "EE Sound", desc: "Spread your lips slightly. Teeth close (almost touching). Tongue high-front; sides lightly touch upper teeth." },
  UW: { title: "OO Sound", desc: "Round the lips more. Tongue high-back. Keep it dark and steady (don’t front it)." },
  UX: { title: "UX Sound", desc: "A short, reduced UW. Keep it quick and relaxed—small lip rounding, minimal movement." },
  EH: { title: "EH Sound", desc: "Jaw slightly open. Tongue mid-front. Keep it clean—don’t glide toward AY." },
  IH: { title: "IH Sound", desc: "Tongue high-front but relaxed. Lips neutral. Keep it short—don’t tense into EE." },
  UH: { title: "UH Sound", desc: "Tongue high-back. Lips relaxed (not strongly rounded). Keep it short and steady." },
  AH: { title: "UH (AH) Sound", desc: "Neutral mouth. Tongue central and relaxed. Don’t over-round or over-smile." },
  AX: { title: "Schwa (AX)", desc: "Very relaxed and quick. Minimal mouth shaping—let it be neutral and unstressed." },
  AXR: { title: "R-colored Schwa (AXR)", desc: "Like schwa, but add an R-color. Keep the tongue bunched/curl slightly without touching." },
  AE: { title: "AE Sound", desc: "Spread the lips slightly. Jaw open more than EH. Tongue front and low-mid." },
  EY: { title: "AY (EY) Sound", desc: "Start at EH and glide slightly upward. Keep it controlled—don’t overdo the glide." },
  AY: { title: "AI (AY) Sound", desc: "Start open (AH/AA-like), then glide up toward EE. Keep it smooth and clear." },
  OW: { title: "OH-OO (OW) Sound", desc: "Start rounded, then glide toward OO. Keep the glide clear (not flat)." },
  AW: { title: "OW (AW) Sound", desc: "Start open (AH/AA-like), then glide toward OO. Lips round more as you glide." },
  OY: { title: "OY Sound", desc: "Start rounded (O), then glide to EE. Keep both parts distinct and smooth." },

  // consonants
  P: { title: "P Sound", desc: "Close both lips. Build pressure. Release with a clear puff of air (aspiration)." },
  B: { title: "B Sound", desc: "Close both lips. Voice ON (buzz). Release cleanly with minimal extra vowel." },
  T: { title: "T Sound", desc: "Tongue tip to ridge behind top teeth. Release cleanly. Keep it crisp (no extra schwa)." },
  D: { title: "D Sound", desc: "Tongue tip to ridge. Voice ON. Release quickly and cleanly." },
  K: { title: "K Sound", desc: "Back of tongue touches the soft palate. Build pressure. Release with a clean burst." },
  G: { title: "G Sound", desc: "Like K but voiced. Keep a gentle buzz and release cleanly." },
  CH:{ title: "CH Sound", desc: "Start with a T-like stop, then release into SH. Keep it crisp: ‘tch’." },
  JH:{ title: "J Sound", desc: "Like CH but voiced. Keep a buzz while releasing (as in ‘judge’)." },
  F: { title: "F Sound", desc: "Top teeth lightly touch lower lip. Blow air continuously. No voicing." },
  V: { title: "V Sound", desc: "Top teeth on lower lip. Voice ON (buzz) while air flows continuously." },
  TH:{ title: "TH Sound", desc: "Tongue lightly between teeth. Air flows out. No voicing (unlike DH)." },
  DH:{ title: "DH Sound", desc: "Tongue lightly between teeth. Voice ON (buzz). Keep it gentle." },
  S: { title: "S Sound", desc: "Tongue close to ridge with a narrow channel. Strong, steady airflow. No voicing." },
  Z: { title: "Z Sound", desc: "Like S but voiced. Keep a buzz while maintaining the narrow airflow." },
  SH:{ title: "SH Sound", desc: "Tongue slightly back. Narrow groove. Smooth steady airflow (hiss), no voicing." },
  ZH:{ title: "ZH Sound", desc: "Like SH but voiced (buzz), as in ‘vision’." },
  HH:{ title: "H Sound", desc: "Just breathy airflow from the throat. Don’t add an extra vowel before it." },
  M: { title: "M Sound", desc: "Close lips and keep voicing. Let air go through the nose; feel nasal vibration." },
  N: { title: "N Sound", desc: "Tongue tip up. Voice ON. Air through the nose (nasal)." },
  NG:{ title: "NG Sound", desc: "Back of tongue up (like K/G position). Voice ON. Air through the nose (no release)." },
  L: { title: "L Sound", desc: "Tongue tip to ridge. Keep airflow around the sides of the tongue." },
  R: { title: "R Sound", desc: "Curl or bunch the tongue without touching. Slight lip rounding. Keep it smooth." },
  ER:{ title: "ER Sound", desc: "R-colored vowel. Bunch/curl tongue, lips slightly rounded. Hold it steady." },
  W: { title: "W Sound", desc: "Strong lip rounding, then quickly move into the next vowel. Don’t hold it too long." },
  Y: { title: "Y Sound", desc: "Tongue high-front (like EE start), then glide quickly into the next vowel." },
};

function getPhonemeUiCopy(code) {
  const c = String(code || "").trim().toUpperCase();
  return PHONEME_UI_COPY[c] || { title: `${c} Sound`, desc: "Focus on a clean mouth shape and a steady, controlled sound." };
}


function getListenFor(code) {
  const c = String(code || "").trim().toUpperCase();
  return PHONEME_LISTEN_FOR[c] || null;
}


function getPhonemeTip(code) {
  const c = String(code || "").trim().toUpperCase();
  return PHONEME_TIPS[c] || null;
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

/* ---------------- simple pools ---------------- */
const WORDS = {
  easy: ["water", "coffee", "music", "people", "world", "future", "camera", "really"],
  medium: ["comfortable", "sentence", "accent", "problem", "thirty", "through", "thought", "focus"],
  hard: ["particularly", "entrepreneurship", "authenticity", "responsibility", "vulnerability"],
};

const SENTENCES = {
  easy: ["I like coffee.", "The water is cold.", "I live in Denmark.", "This is my phone."],
  medium: [
    "I want to sound more natural when I speak.",
    "Please try to pronounce this clearly and slowly.",
    "I recorded my voice and got feedback.",
  ],
  hard: [
    "I would rather practice consistently than rush and burn out.",
    "Clear pronunciation comes from rhythm, stress, and good vowels.",
  ],
};

function pickRandom(arr) {
  if (!arr?.length) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---------------- Assets you actually have ---------------- */
/**
 * Images in: public/phonemes/images/<CODE>.png
 * Audio in:  public/phonemes/audio/en_br/<CODE>.mp3
 *           public/phonemes/audio/en_us/AO_us.mp3
 *
 * If missing -> we skip feedback for that phoneme (as requested).
 */

function resolvePhonemeAssets(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return { videoSrc: null, imageSrc: null };

  return {
    videoSrc: `/phonemes/Videos/${c}.mp4`,
    imageSrc: `/phonemes/images/${c}.png`,
  };
}


/* ---------------- SpeechSuper parsing helpers ---------------- */
function getPhonemeCode(p) {
  return String(p?.phoneme || p?.ipa || p?.symbol || "").trim().toUpperCase();
}

function getPhonemeLetters(p) {
  // Only use what SpeechSuper actually provides — no guessing.
  const v =
    p?.letters ??
    p?.grapheme ??
    p?.graphemes ??
    p?.text ??
    p?.token ??
    p?.char ??
    p?.chars;

  if (Array.isArray(v)) {
    const s = v.map((x) => String(x || "").trim()).filter(Boolean).join("");
    return s || null;
  }

  const s = String(v || "").trim();
  return s || null;
}


function getScore(obj) {
  const v =
    obj?.accuracyScore ?? // ✅ foretræk 0–100 når den findes
    obj?.overallAccuracy ??
    obj?.accuracy ??
    obj?.pronunciation ??
    obj?.score ??
    obj?.overall ??
    obj?.pronunciationAccuracy ??
    obj?.accuracyScore;

  const n = Number(v);
  if (!Number.isFinite(n)) return null;

  // ✅ hvis 0–1, gør til 0–100
  return n <= 1 ? Math.round(n * 100) : n;
}


// same simple color logic for word + phonemes
function scoreColor(score) {
  if (score == null) return "rgba(17,24,39,0.55)";
  if (score >= 85) return "#16a34a"; // green
  if (score >= 70) return "#f59e0b"; // amber
  return "#ef4444"; // red
}
function isGreen(score) {
  return score != null && score >= 85;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Flytter alle phoneme-scores så deres gennemsnit matcher wordScore.
 * (Så "stemningen" i phonemerne matcher ordet.)
 */
function normalizePhonemeScore(phonemeScore, wordScore, allPhonemeScores) {
  if (phonemeScore == null || wordScore == null) return phonemeScore;

  const scores = (allPhonemeScores || []).filter((x) => Number.isFinite(x));
  if (!scores.length) return phonemeScore;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const shift = wordScore - mean; // hvor meget phonemerne skal "op/ned"
  return clamp(phonemeScore + shift, 0, 100);
}


function normalizeWordsFromResult(result, fallbackText) {
  const arr = Array.isArray(result?.words) ? result.words : null;
  if (arr?.length) return arr;

  // fallback if SpeechSuper doesn't return words array
  const text = String(fallbackText || "").trim();
  if (!text) return [];
  const parts = text.split(/\s+/g).filter(Boolean);
  return parts.map((w) => ({ word: w, phonemes: [] }));
}

/* ---------------- page ---------------- */
export default function Coach() {
  const { settings } = useSettings();

  // light tokens
  const LIGHT_TEXT = "rgba(17,24,39,0.92)";
  const LIGHT_MUTED = "rgba(17,24,39,0.55)";
  const LIGHT_BORDER = "rgba(0,0,0,0.10)";
  const LIGHT_SHADOW = "0 10px 24px rgba(0,0,0,0.06)";
  const LIGHT_SURFACE = "#FFFFFF";
  const LIGHT_BG = "#EEF5FF";
  const BTN_BLUE = "#2196F3";

const TABBAR_OFFSET = 64;
const SAFE_BOTTOM = "env(safe-area-inset-bottom, 0px)";
const SAFE_TOP = "env(safe-area-inset-top, 0px)";


// dropdown state
const [mode, setMode] = useState("words"); // words | sentences
const [difficulty, setDifficulty] = useState("easy"); // easy | medium | hard

  const [accentUi, setAccentUi] = useState(settings?.accentDefault || "en_us");
const MODE_OPTIONS = ["words", "sentences"];
const MODE_LABEL = { words: "Words", sentences: "Sentences" };


const DIFF_OPTIONS = ["easy", "medium", "hard"];
const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };

const ACCENT_OPTIONS = ["en_us", "en_br"];
const ACCENT_LABEL = { en_us: "American 🇺🇸", en_br: "British 🇬🇧" };

function cycleValue(options, current, dir) {
  const i = Math.max(0, options.indexOf(current));
  const next = (i + dir + options.length) % options.length;
  return options[next];
}

  useEffect(() => {
    setAccentUi(settings?.accentDefault || "en_us");
  }, [settings?.accentDefault]);
  // ✅ Prefetch as soon as Coach page opens (so first click is fast)
useEffect(() => {
  const warm = [
    "Repeat after me.",
    ...WORDS.easy,
    ...WORDS.medium,
    ...SENTENCES.easy.slice(0, 2),
  ];

  // fire-and-forget, and don't block initial render
  setTimeout(() => {
    prefetchTtsBatch(warm, 0.98);
  }, 0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [accentUi]);



  // ✅ stages: setup -> intro (speaking) -> flow
  const [stage, setStage] = useState("setup"); // setup | intro | flow

  // speaking indicator
  const [isSpeaking, setIsSpeaking] = useState(false);

  // flow state
  const [target, setTarget] = useState("");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("");

  // overlay state (sentence dropdown)
  const [selectedWordIdx, setSelectedWordIdx] = useState(-1);
  const [expandedPhonemeKey, setExpandedPhonemeKey] = useState(null); // e.g. "UW_3"
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
const [videoMuted, setVideoMuted] = useState(true);
const [badVideoByCode, setBadVideoByCode] = useState({});
const [badImageByCode, setBadImageByCode] = useState({});

const videoRef = useRef(null);

const [wordsOpen, setWordsOpen] = useState(false); // ✅ dropdown open/closed
const [slideIdx, setSlideIdx] = useState(0);

// intro count-up (samme idé som PracticeMyText)
const [introPhase, setIntroPhase] = useState("idle"); // idle | counting | done
const [introPct, setIntroPct] = useState(0);
const [overallPct, setOverallPct] = useState(0); // ✅ real score (0–100)

const [introStep, setIntroStep] = useState(0); // 0 idle | 1 word | 2 move | 3 pct | 4 label

const introRafRef = useRef(0);
const introTargetRef = useRef(0); // ✅ freeze target (0–100)

const introTimersRef = useRef([]);
function clearIntroTimers() {
  try { introTimersRef.current.forEach((t) => clearTimeout(t)); } catch {}
  introTimersRef.current = [];
}
useEffect(() => {
if (introStep !== 3) return;

  setIntroPhase("counting");
  setIntroPct(0);

  try { cancelAnimationFrame(introRafRef.current); } catch {}

  introRafRef.current = requestAnimationFrame(() => {
    const start = performance.now();
    const DUR = 850;

    const step = (now) => {
      const t = Math.min(1, (now - start) / DUR);
      const target = introTargetRef.current || 0;
      setIntroPct(Math.round(target * t));

      if (t < 1) introRafRef.current = requestAnimationFrame(step);
      else {
        setIntroPct(target);
        setIntroPhase("done");
      }
    };

    introRafRef.current = requestAnimationFrame(step);
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [introStep]);

 // overlayTabs index


  // recording
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isBusy = isRecording || isAnalyzing;

const micStreamRef = useRef(null);

  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const [lastUrl, setLastUrl] = useState(null);

  // ✅ TTS audio (Azure via /api/tts)
  const ttsAudioRef = useRef(null);
  const ttsUrlRef = useRef(null);
  const ttsAbortRef = useRef(null);
  const ttsPlayIdRef = useRef(0);
  const prewarmUrlRef = useRef(null);
  const [prewarmReady, setPrewarmReady] = useState(false);

  // overlay phoneme audio player
  const overlayAudioRef = useRef(null);
  const exampleAudioRef = useRef(null);
const exampleUrlRef = useRef(null);
const exampleTtsCacheRef = useRef(new Map()); // key: `${accentUi}|${word}` -> objectURL
// ✅ Cache for "Correct pronunciation" (and any other TTS prefetch)
const ttsCacheRef = useRef(new Map()); // key: `${accentUi}|${rate}|${text}` -> objectURL

// play/pause state for the big play buttons
const [isUserPlaying, setIsUserPlaying] = useState(false);
const [isCorrectPlaying, setIsCorrectPlaying] = useState(false);
// ---- Playback helpers (Slide 2) ----
const LOOP_WINDOW_SEC = 2.5;

const [playbackRate, setPlaybackRate] = useState(1.0); // 1.0 | 0.85 | 0.75
const [loopOn, setLoopOn] = useState(false);
const [isABPlaying, setIsABPlaying] = useState(false);

const playbackRateRef = useRef(1.0);
const loopOnRef = useRef(false);
const abAudioRef = useRef(null);
const abTokenRef = useRef(0);

useEffect(() => {
  playbackRateRef.current = playbackRate;
}, [playbackRate]);

useEffect(() => {
  loopOnRef.current = loopOn;
}, [loopOn]);

useEffect(() => {
  // When you leave/enter slides, stop looping
  disableLoopNow();

  // Also stop any running audio so it doesn't keep looping in background
  stopABNow();
  try { overlayAudioRef.current?.pause?.(); } catch {}
  try { ttsAudioRef.current?.pause?.(); } catch {}
  setIsUserPlaying(false);
  setIsCorrectPlaying(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [slideIdx]);


useEffect(() => {
  // apply to currently used players (if any)
  try { applyPlaybackSettings(overlayAudioRef.current); } catch {}
  try { applyPlaybackSettings(ttsAudioRef.current); } catch {}
  try { applyPlaybackSettings(abAudioRef.current); } catch {}

  try {
    attachLoopHandler(overlayAudioRef.current);
    attachLoopHandler(ttsAudioRef.current);
    attachLoopHandler(abAudioRef.current);

    if (loopOn) {
      enableLoopWindow(overlayAudioRef.current);
      enableLoopWindow(ttsAudioRef.current);
      enableLoopWindow(abAudioRef.current);
    }
  } catch {}
}, [playbackRate, loopOn]);

const userSrcRef = useRef("");
const correctTextRef = useRef("");


  // pop effect while the target is spoken
  const [isSpeakingTarget, setIsSpeakingTarget] = useState(false);



  useEffect(() => {
    // ✅ reset prewarm when accent changes (so voice can change)
    if (prewarmUrlRef.current) {
      try { URL.revokeObjectURL(prewarmUrlRef.current); } catch {}
      prewarmUrlRef.current = null;
      setPrewarmReady(false);
    }
      // ✅ clear example TTS cache when accent changes
  try {
    const cache = exampleTtsCacheRef.current;
    if (cache && cache.size) {
      for (const url of cache.values()) {
        try { URL.revokeObjectURL(url); } catch {}
      }
      cache.clear();
    }
  } catch {}
    // ✅ clear main TTS cache when accent changes (so we don't play wrong accent)
  try {
    const cache = ttsCacheRef.current;
    if (cache && cache.size) {
      for (const url of cache.values()) {
        try { URL.revokeObjectURL(url); } catch {}
      }
      cache.clear();
    }
  } catch {}


      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentUi]);

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

 function disposeRecorder() {
  try {
    micStreamRef.current?.getTracks?.()?.forEach((t) => t.stop());
  } catch {}
  micStreamRef.current = null;
  mediaRecRef.current = null;
}

  async function ensureMic() {
   if (!navigator?.mediaDevices?.getUserMedia) throw new Error("Microphone not supported on this device.");
const stream = micStreamRef.current || (await navigator.mediaDevices.getUserMedia({ audio: true }));
micStreamRef.current = stream;

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

  function buildNewTarget(nextMode = mode, nextDiff = difficulty) {
    const pool = nextMode === "sentences" ? (SENTENCES[nextDiff] || []) : (WORDS[nextDiff] || []);
    return pickRandom(pool);
  }
  function isUrlInTtsCache(url) {
    if (!url) return false;
    const cache = ttsCacheRef.current;
    if (!cache || !cache.size) return false;
    for (const v of cache.values()) {
      if (v === url) return true;
    }
    return false;
  }

  function stopTtsNow() {
    ttsPlayIdRef.current += 1;
    try { ttsAbortRef.current?.abort?.(); } catch {}
    ttsAbortRef.current = null;

    try {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
        ttsAudioRef.current.src = "";
        ttsAudioRef.current.load?.();
      }
    } catch {}

     try {
      if (ttsUrlRef.current && !isUrlInTtsCache(ttsUrlRef.current)) {
        URL.revokeObjectURL(ttsUrlRef.current);
      }
    } catch {}
    ttsUrlRef.current = null;


    setIsSpeaking(false);
    setIsSpeakingTarget(false);
    setIsCorrectPlaying(false);

  }

function stopABNow() {
  abTokenRef.current += 1;
  setIsABPlaying(false);
  try {
    const a = abAudioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
      a.src = "";
    }
  } catch {}
}

function stopAllAudio() {
  // stop loops + A/B + TTS
  disableLoopNow();
  stopABNow();
  stopTtsNow();

  // stop overlay player
  try { overlayAudioRef.current?.pause?.(); } catch {}
  try {
    if (overlayAudioRef.current) {
      overlayAudioRef.current.currentTime = 0;
    }
  } catch {}

  // stop example audio
  try { exampleAudioRef.current?.pause?.(); } catch {}
  try {
    if (exampleAudioRef.current) exampleAudioRef.current.currentTime = 0;
  } catch {}

  // stop video
  try {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  } catch {}

  setIsUserPlaying(false);
  setIsCorrectPlaying(false);
  setIsABPlaying(false);
}


function disableLoopNow() {
  loopOnRef.current = false; // stop instantly (no waiting for React state)
  setLoopOn(false);
}


function applyPlaybackSettings(a) {
  if (!a) return;
  try {
    a.playbackRate = playbackRateRef.current || 1.0;
    a.volume = settings?.soundEnabled === false ? 0 : 1;
  } catch {}
}

function enableLoopWindow(a) {
  if (!a) return;

  try {
    a.__loopStart = 0;

    // If duration is known, don't set loopEnd beyond duration (or it will just end and never loop)
    const dur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : null;

    // keep a tiny safety margin so we don't seek to exactly the end
    const safeEnd = dur ? Math.max(0.15, dur - 0.05) : LOOP_WINDOW_SEC;

    a.__loopEnd = Math.min(LOOP_WINDOW_SEC, safeEnd);

    // snap into loop window
    if (a.currentTime < a.__loopStart || a.currentTime >= a.__loopEnd) {
      a.currentTime = a.__loopStart;
    }
  } catch {}
}

function attachLoopHandler(a) {
  if (!a) return;

  // attach once per element/object (prevents overwriting other onended/onplay handlers)
  if (a.__loopHandlersAttached) return;
  a.__loopHandlersAttached = true;

  const onLoadedMeta = () => {
    // When metadata loads, we can clamp loopEnd to duration
    try {
      if (!loopOnRef.current) return;
      enableLoopWindow(a);
    } catch {}
  };

  const onTimeUpdate = () => {
    try {
      if (!loopOnRef.current) return;
      const start = Number(a.__loopStart ?? 0);
      const end = Number(a.__loopEnd ?? LOOP_WINDOW_SEC);

      if (a.currentTime >= end) {
        a.currentTime = start;
        // If the browser paused at the boundary, force continue
        if (a.paused) a.play().catch(() => {});
      }
    } catch {}
  };

  const onEnded = () => {
    try {
      if (!loopOnRef.current) return;
      const start = Number(a.__loopStart ?? 0);
      a.currentTime = start;
      a.play().catch(() => {});
    } catch {}
  };

  // store refs (optional, but nice for debugging)
  a.__onLoopLoadedMeta = onLoadedMeta;
  a.__onLoopTimeUpdate = onTimeUpdate;
  a.__onLoopEnded = onEnded;

  a.addEventListener("loadedmetadata", onLoadedMeta);
  a.addEventListener("timeupdate", onTimeUpdate);
  a.addEventListener("ended", onEnded);
}


  
  async function playTts(text, rate = 1.0) {
    const t = String(text || "").trim();
    if (!t) return;

    try {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      }
    } catch {}

    try { if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current); } catch {}
    ttsUrlRef.current = null;

    const base = getApiBase();
    const myId = ++ttsPlayIdRef.current;

    try { ttsAbortRef.current?.abort?.(); } catch {}
    const controller = new AbortController();
    ttsAbortRef.current = controller;

    let r;
    try {
      r = await fetch(`${base}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, accent: accentUi, rate }),
        signal: controller.signal,
      });
    } catch (e) {
      if (e?.name === "AbortError") return;
      throw e;
    }

    if (myId !== ttsPlayIdRef.current) return;

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j?.detail || j?.error || `TTS failed (${r.status})`);
    }

    let buf;
    try {
      buf = await r.arrayBuffer();
    } catch (e) {
      if (e?.name === "AbortError") return;
      throw e;
    }
    if (myId !== ttsPlayIdRef.current) return;

    const blob = new Blob([buf], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    ttsUrlRef.current = url;

    const a = ttsAudioRef.current;
    if (!a) return;

    a.src = url;
    a.volume = settings?.soundEnabled === false ? 0 : 1;

    if (myId !== ttsPlayIdRef.current) return;

await a.play();



  }

  async function fetchTtsUrl(text, rate = 1.0) {
    const t = String(text || "").trim();
    if (!t) return null;

    const base = getApiBase();
    const controller = new AbortController();

    const r = await fetch(`${base}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t, accent: accentUi, rate }),
      signal: controller.signal,
    });

    if (!r.ok) return null;

    const buf = await r.arrayBuffer();
    const blob = new Blob([buf], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  }

  async function playPrewarmedUrl(url) {
    const myId = ++ttsPlayIdRef.current;

    try {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      }
    } catch {}

    const a = ttsAudioRef.current;
    if (!a) return;

    a.src = url;
    a.volume = settings?.soundEnabled === false ? 0 : 1;

    // IMPORTANT: do NOT wait for onended — allow instant re-trigger
try {
  await a.play();
} catch {}
return;
  }

  async function prewarmRepeat() {
    if (prewarmUrlRef.current) return;

    try {
      const base = getApiBase();
      const r = await fetch(`${base}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Repeat after me.", accent: accentUi, rate: 1.0 }),
      });
      if (!r.ok) return;

      const buf = await r.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);

      prewarmUrlRef.current = url;
      setPrewarmReady(true);
    } catch {
      // ignore
    }
  }

async function speakSequence(t) {
  const text = String(t || "").trim();
  if (!text) return;

  // stop current TTS immediately (so button can be spam-clicked)
  stopTtsNow();

  setIsSpeakingTarget(true);

  // fire-and-forget
  await playTts(text, 0.98);

  // end animation when audio ends (without blocking new plays)
  const a = ttsAudioRef.current;
  if (a) {
    const id = ttsPlayIdRef.current;
    a.onended = () => {
      if (id === ttsPlayIdRef.current) setIsSpeakingTarget(false);
    };
    a.onerror = () => {
      if (id === ttsPlayIdRef.current) setIsSpeakingTarget(false);
    };
  } else {
    setIsSpeakingTarget(false);
  }
}


  async function beginIntroThenFlow() {
    const t = buildNewTarget(mode, difficulty);
    setTarget(t);
    setResult(null);
    setStatus("");
    setSelectedWordIdx(-1);

    const targetUrlPromise = fetchTtsUrl(t, 0.98);

    setIsSpeaking(true);
    try {
      if (prewarmUrlRef.current) await playPrewarmedUrl(prewarmUrlRef.current);
      else await playTts("Repeat after me.", 1.0);
    } catch (e) {
      if (!IS_PROD) console.warn("[TTS intro]", e);
    } finally {
      setIsSpeaking(false);
    }

    setStage("flow");

    setIsSpeakingTarget(true);
    try {
      const targetUrl = await targetUrlPromise;
      if (targetUrl) {
        await playPrewarmedUrl(targetUrl);
        try { URL.revokeObjectURL(targetUrl); } catch {}
      } else {
        await playTts(t, 0.98);
      }
    } catch (e) {
      if (!IS_PROD) console.warn("[TTS target]", e);
    } finally {
      setIsSpeakingTarget(false);
    }
  }

async function onStart() {
  if (isBusy) return;

  const t = buildNewTarget(mode, difficulty);
  setTarget(t);
    // ✅ prefetch correct pronunciation for this target immediately
  prefetchTtsText(t, 0.98);
  setResult(null);
  setStatus("");
  setSelectedWordIdx(-1);
  setExpandedPhonemeKey(null);

 setStage("flow");
await ensureMic(); // okay at keep mic warm (valgfrit)
// ❌ no autoplay

}


function onBack() {
  if (isBusy) return;
  stopTtsNow();
  stopABNow();

  try {
    if (lastUrl) URL.revokeObjectURL(lastUrl);
  } catch {}
  setLastUrl(null);

  disposeRecorder();
  setIsRecording(false);
  setIsAnalyzing(false);

  setTarget("");
  setResult(null);
  setStatus("");
  setStage("setup");
  setSelectedWordIdx(-1);
  setExpandedPhonemeKey(null);
  setWordsOpen(false);
  setIsUserPlaying(false);
  setIsCorrectPlaying(false);

  setSlideIdx(0);
setIntroPhase("idle");
setIntroPct(0);
setIntroStep(0);
clearIntroTimers();

}


  function handleStop(rec) {
    setIsRecording(false);

    const chunks = chunksRef.current.slice();
    chunksRef.current = [];

    
    try {
      if (lastUrl) URL.revokeObjectURL(lastUrl);
    } catch {}

    const type = chunks[0]?.type || rec?.mimeType || "audio/webm";
    const blob = new Blob(chunks, { type });
    const localUrl = URL.createObjectURL(blob);

    setLastUrl(localUrl);
    setIsAnalyzing(true);
    sendToServer(blob, localUrl);
  }

  async function startRecording() {
    if (!target?.trim()) return;
    setStatus("");
    await ensureMic();
    chunksRef.current = [];
    mediaRecRef.current.start();
    setIsRecording(true);
  }

  function stopRecording() {
    try {
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
    } catch {}
  }

  async function toggleRecord() {
    if (isRecording) stopRecording();
    else if (!isAnalyzing) await startRecording();
  }

  async function sendToServer(audioBlob, localUrl) {
    try {
      const base = getApiBase();

      const fd = new FormData();
      fd.append("audio", audioBlob, "clip.webm");
      fd.append("refText", target);
      fd.append("accent", accentUi === "en_br" ? "en_br" : "en_us");

const timeoutMs = 15000;
const controller = new AbortController();
const t = setTimeout(() => controller.abort(), timeoutMs);

let r;
try {
  r = await fetch(`${base}/api/analyze-speech`, {
    method: "POST",
    body: fd,
    signal: controller.signal,
  });
} catch (e) {
  if (e?.name === "AbortError") {
    throw new Error(`Analysis timed out after ${Math.round(timeoutMs / 1000)}s`);
  }
  throw e;
} finally {
  clearTimeout(t);
}
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json?.error || r.statusText || "Analyze failed");
      // ✅ Save Coach phoneme attempts locally so WeaknessLab includes them too
      try {
        const accentKey = accentUi === "en_br" ? "en_br" : "en_us";

        // Collect phoneme scores from SpeechSuper "words[].phonemes[]"
        const phonemePairs = [];
        const wordsArr = Array.isArray(json?.words) ? json.words : [];
        for (const w of wordsArr) {
          const ps = Array.isArray(w?.phonemes) ? w.phonemes : [];
          for (const p of ps) {
            const code = String(p?.phoneme || p?.ipa || p?.symbol || "").trim().toUpperCase();
            if (!code) continue;

            const raw =
              p?.accuracyScore ??
              p?.overallAccuracy ??
              p?.accuracy ??
              p?.pronunciation ??
              p?.score ??
              p?.overall ??
              p?.pronunciationAccuracy;

            const n = Number(raw);
            if (!Number.isFinite(n)) continue;

            const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
            phonemePairs.push({ phoneme: code, score: pct });
          }
        }

        // Only ingest if we actually found phonemes
        if (phonemePairs.length) ingestLocalPhonemeScores(accentKey, phonemePairs);
      } catch {
        // ignore
      }

      const payload = {
        ...json,
        userAudioUrl: localUrl,
        userAudioBlob: audioBlob,
        refText: target,
        accent: accentUi,
        createdAt: Date.now(),
      };
setResult(payload);
setSlideIdx(0);

// ✅ compute overall FIRST (0–100)
const rawOverall =
  json?.overall ??
  json?.overallAccuracy ??
  json?.pronunciation ??
  json?.overall_score ??
  json?.overall_accuracy ??
  json?.pronunciation_score ??
  json?.pronunciation_accuracy ??
  json?.accuracyScore ??
  json?.accuracy_score ??
  0;

let overall = Number(rawOverall);
if (!Number.isFinite(overall)) overall = 0;
if (overall > 0 && overall <= 1) overall = overall * 100;
overall = clamp(Math.round(overall), 0, 100);
setOverallPct(overall); // ✅ store real score for intro slide


// ✅ freeze target for intro count-up
introTargetRef.current = overall;

// ✅ run the exact visual sequence: word fades in → word moves up → % fades in at center → label fades in
clearIntroTimers();
setIntroPhase("idle");
setIntroPct(0);
setIntroStep(1);

introTimersRef.current.push(setTimeout(() => setIntroStep(2), 380));
introTimersRef.current.push(setTimeout(() => setIntroStep(3), 720));
introTimersRef.current.push(setTimeout(() => setIntroStep(4), 900));




setDeepDiveOpen(false);
setVideoMuted(true);
setIsUserPlaying(false);
setIsCorrectPlaying(false);


const wordsArr = Array.isArray(payload?.words) ? payload.words : [];
const sentenceLike = (mode === "sentences") || (wordsArr.length > 1);

if (sentenceLike) {
  // ✅ Start as list (like screenshot 3): show all words, no feedback yet
  setWordsOpen(false);
  setSelectedWordIdx(-1);
  setExpandedPhonemeKey(null);
} else {
  // single word mode: keep showing tips UI
  setWordsOpen(false);
  setSelectedWordIdx(0);

  const onlyWord = wordsArr[0] || null;
  const firstTipKey = getFirstTipKeyForWord(onlyWord);
  setExpandedPhonemeKey(firstTipKey || null);
}


      const threshold = difficulty === "easy" ? 75 : difficulty === "medium" ? 82 : 88;

    if (overall >= threshold + 7) {
  setStatus("Well done ✅");
  const next = buildNewTarget(mode, difficulty);
  setTarget(next);
    prefetchTtsText(next, 0.98);

  // don't auto-speak
} else if (overall >= threshold) {
  setStatus("That’s alright — next 👌");
  const next = buildNewTarget(mode, difficulty);
  setTarget(next);
    prefetchTtsText(next, 0.98);

  // don't auto-speak
} else {
  setStatus("Try again (listen to the feedback) 🔁");
}

   } catch (e) {
  const msg = e?.message || String(e);
  const isTimeout = /timed out/i.test(msg);

  setStatus(
    isTimeout
      ? "Analysis took too long. Try again."
      : (IS_PROD ? "Something went wrong. Try again." : msg)
  );
} finally {
  setIsAnalyzing(false);
}

} // ✅ CLOSE sendToServer

/* ---------------- overlay data ---------------- */
const words = useMemo(() => normalizeWordsFromResult(result, target), [result, target]);



  /* ---------------- overlay data ---------------- */
  const isSentence = useMemo(() => (mode === "sentences") || (words?.length > 1), [mode, words?.length]);

 const maxIdx = Math.max(0, (words?.length || 1) - 1);
const safeWordIdx = selectedWordIdx < 0 ? -1 : Math.max(0, Math.min(selectedWordIdx, maxIdx));
const currentWordObj = safeWordIdx >= 0 ? (words?.[safeWordIdx] || null) : null;

  const currentWordText = String(
  currentWordObj?.word || currentWordObj?.text || currentWordObj?.name || (isSentence ? "" : target) || ""
).trim();
  const currentWordScore = getScore(currentWordObj);
const wordOnlyResult = useMemo(() => {
  if (!result || !currentWordObj) return null;

  const t = String(currentWordText || "").trim();

  return {
    ...result,
    // 👇 force it to behave like a single-word result
    words: [currentWordObj],
    target: t,
    reference: t,
    text: t,
    refText: t,
  };
}, [result, currentWordObj, currentWordText]);

const phonemeLineItems = useMemo(() => {
  const ps = Array.isArray(currentWordObj?.phonemes) ? currentWordObj.phonemes : [];
  const out = [];

  const rawScores = ps.map(getScore).filter((x) => Number.isFinite(x));

  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const code = getPhonemeCode(p);
    if (!code) continue;

    const raw = getScore(p);
    const s = normalizePhonemeScore(raw, currentWordScore, rawScores);

const assets = resolvePhonemeAssets(code);
const hasAnyAsset = !!assets?.videoSrc || !!assets?.imageSrc;

out.push({
  key: `${code}_${i}`,
  code,
  score: s,
  rawScore: raw,
  letters: getPhonemeLetters(p),
  assets, // { videoSrc, imageSrc }
  hasAsset: hasAnyAsset,
  isWeak: s == null || !isGreen(s),
});


  }

  return out;
}, [currentWordObj, accentUi, currentWordScore]);

const weakItems = useMemo(
  () => phonemeLineItems.filter((x) => x.hasAsset && x.isWeak)
,
  [phonemeLineItems]
);

// 1:1 slides: Intro -> weak phonemes (score null/<85) -> Playback -> Actions
const slides = useMemo(() => {
  const list = [];

  list.push({ type: "intro", key: "intro" });

  const weakSlides = buildWeakPhonemeSlidesFromWords(words);
  for (const s of weakSlides) list.push(s);

  list.push({ type: "playback", key: "playback" });
  list.push({ type: "actions", key: "actions" });

  return list;
}, [words]);

const totalSlides = slides.length || 1;
const activeSlide =
  slides[Math.max(0, Math.min(slideIdx, totalSlides - 1))] || slides[0];


function buildWeakPhonemeSlidesFromWords(wordsArr) {
  const wordsSafe = Array.isArray(wordsArr) ? wordsArr : [];

  // Aggregate to ONE slide per phoneme code (worst score wins)
  const byCode = new Map(); // code -> { score, rawScore, wordIdx, wordText, assets }

  for (let wIdx = 0; wIdx < wordsSafe.length; wIdx++) {
    const w = wordsSafe[wIdx];
    const ps = Array.isArray(w?.phonemes) ? w.phonemes : [];
    const wordScore = getScore(w);
    const rawScores = ps.map(getScore).filter((x) => Number.isFinite(x));

    for (let pIdx = 0; pIdx < ps.length; pIdx++) {
      const p = ps[pIdx];
      const code = getPhonemeCode(p);
      if (!code) continue;

      const raw = getScore(p);
      const norm = normalizePhonemeScore(raw, wordScore, rawScores);

      // weak definition: score == null || < 85
      const weak = norm == null || norm < 85;
      if (!weak) continue;

const assets = resolvePhonemeAssets(code);
const hasAnyAsset = !!assets?.videoSrc || !!assets?.imageSrc;
if (!hasAnyAsset) continue;


      const existing = byCode.get(code);

      // "worse" = lower score, and null is worst
      const isWorse =
        !existing ||
        existing.score == null ||
        (norm == null ? true : (existing.score != null && norm < existing.score));

      if (isWorse) {
        byCode.set(code, {
          type: "phoneme",
          key: `${code}`, // one slide per phoneme
          code,
          score: norm,
          rawScore: raw,
          wordIdx: wIdx,
          wordText: String(w?.word || w?.text || "").trim(),
          assets,
        });
      }
    }
  }

  // Sort worst -> best (null first)
  const slides = Array.from(byCode.values()).sort((a, b) => {
    const as = a.score;
    const bs = b.score;
    if (as == null && bs == null) return 0;
    if (as == null) return -1;
    if (bs == null) return 1;
    return as - bs;
  });

  return slides;
}



function toggleOverlayAudio(src, kind) {
  if (!src) return;

  try {
    if (!overlayAudioRef.current) overlayAudioRef.current = new Audio();
    const a = overlayAudioRef.current;

    const isSameSrc = userSrcRef.current === src;

    // If same src and currently playing -> pause
   if (isSameSrc && !a.paused && !a.ended) {
  disableLoopNow();          // ✅ stop loop when user presses pause
  a.pause();
  if (kind === "user") setIsUserPlaying(false);
  return;
}


    // Otherwise: load and play
    a.pause();
    a.currentTime = 0;
    a.src = src;
    userSrcRef.current = src;

    a.volume = settings?.soundEnabled === false ? 0 : 1;

    // update state
    a.onplay = () => {
      if (kind === "user") setIsUserPlaying(true);
    };
    a.onpause = () => {
      if (kind === "user") setIsUserPlaying(false);
    };
    a.onended = () => {
      if (kind === "user") setIsUserPlaying(false);
    };
    a.onerror = () => {
      if (kind === "user") setIsUserPlaying(false);
    };
    // stop AB compare if user manually plays something
    stopABNow();

    applyPlaybackSettings(a);
    attachLoopHandler(a);
    if (loopOnRef.current) enableLoopWindow(a);

    a.play().catch(() => {});
  } catch {}
}

function toggleUserRecording() {
  if (!result?.userAudioUrl) return;
  toggleOverlayAudio(result.userAudioUrl, "user");
}

async function ensureCorrectTtsUrlForAB(text) {
  const t = String(text || "").trim();
  if (!t) return null;

  const key = `${accentUi}|${0.98}|${t}`;
  const cached = ttsCacheRef.current.get(key);
  if (cached) return cached;

  let base = "";
  try {
    base = getApiBase();
  } catch {
    return null;
  }

  try {
    const r = await fetch(`${base}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t, accent: accentUi, rate: 0.98 }),
    });
    if (!r.ok) return null;

    const buf = await r.arrayBuffer();
    const blob = new Blob([buf], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    ttsCacheRef.current.set(key, url);
    return url;
  } catch {
    return null;
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function playSegment(a, src, token) {
  if (!a || !src) return;
  if (token !== abTokenRef.current) return;

  try {
    a.pause();
    a.currentTime = 0;
  } catch {}

  a.src = src;
  applyPlaybackSettings(a);
  attachLoopHandler(a);

  if (loopOnRef.current) enableLoopWindow(a);

  let ended = false;

  const onEnded = () => { ended = true; };
  a.onended = onEnded;

  try {
    await a.play();
  } catch {}

  // If loop is ON: play for window length then switch
  if (loopOnRef.current) {
    const ms = Math.round(LOOP_WINDOW_SEC * 1000);
    await wait(ms);
    try { a.pause(); } catch {}
    return;
  }

  // Otherwise: wait for natural end (poll)
  while (!ended && token === abTokenRef.current) {
    // small poll to avoid complex event cleanup
    // eslint-disable-next-line no-await-in-loop
    await wait(80);
  }
}

async function toggleABCompare() {
  // If already running -> stop
  if (isABPlaying) {
    stopABNow();
    return;
  }

  const userUrl = result?.userAudioUrl;
  const text = String(isSentence ? target : currentWordText).trim();
  if (!userUrl || !text) return;

  // stop other audio
  stopTtsNow();
  try { overlayAudioRef.current?.pause?.(); } catch {}

  const correctUrl = await ensureCorrectTtsUrlForAB(text);
  if (!correctUrl) return;

  if (!abAudioRef.current) abAudioRef.current = new Audio();

  const a = abAudioRef.current;
  setIsABPlaying(true);

  // new run token
  abTokenRef.current += 1;
  const token = abTokenRef.current;

  // Loop A->B until stopped
  while (token === abTokenRef.current) {
    // A = You
    // eslint-disable-next-line no-await-in-loop
    await playSegment(a, userUrl, token);
    if (token !== abTokenRef.current) break;

    // short gap
    // eslint-disable-next-line no-await-in-loop
    await wait(180);
    if (token !== abTokenRef.current) break;

    // B = Correct
    // eslint-disable-next-line no-await-in-loop
    await playSegment(a, correctUrl, token);
    if (token !== abTokenRef.current) break;

    // short gap
    // eslint-disable-next-line no-await-in-loop
    await wait(180);
  }
}


async function toggleCorrectTts() {
  const text = String(isSentence ? target : currentWordText).trim();
  if (!text) return;
  // stop AB compare if user manually plays something
  stopABNow();

  const a = ttsAudioRef.current;
  if (!a) return;

  const sameText = correctTextRef.current === text;

  // If same text and currently playing -> pause
if (sameText && a.src) {
  try {
    if (!a.paused && !a.ended) {
      // ✅ Pause = stop loop + pause
      disableLoopNow();
      a.pause();
      a.currentTime = 0;
      setIsCorrectPlaying(false);
      return;
    }

    // ✅ If not playing, play
    applyPlaybackSettings(a);
    attachLoopHandler(a);
    if (loopOnRef.current) enableLoopWindow(a);

    a.play().catch(() => {});
  } catch {}
  return;
}



  // If same text and we already have src -> just play
  if (sameText && a.src) {
    a.play().catch(() => {});
    return;
  }

  // Otherwise fetch new audio (non-blocking)
  try {
    setIsCorrectPlaying(false);
    correctTextRef.current = text;
    // ✅ If we already prefetched it, play instantly
const ttsCacheKey = `${accentUi}|${0.98}|${text}`;
const cachedUrl = ttsCacheRef.current.get(ttsCacheKey);
    if (cachedUrl) {
  // cleanup old url ref, but DO NOT revoke cached URLs
  try {
    if (ttsUrlRef.current && ttsUrlRef.current !== cachedUrl && !isUrlInTtsCache(ttsUrlRef.current)) {
      URL.revokeObjectURL(ttsUrlRef.current);
    }
  } catch {}
  ttsUrlRef.current = cachedUrl;


      a.pause();
      a.currentTime = 0;
      a.src = cachedUrl;
      a.volume = settings?.soundEnabled === false ? 0 : 1;
applyPlaybackSettings(a);
attachLoopHandler(a);
if (loopOnRef.current) enableLoopWindow(a);

      a.onplay = () => setIsCorrectPlaying(true);
      a.onpause = () => setIsCorrectPlaying(false);
      a.onended = () => setIsCorrectPlaying(false);
      a.onerror = () => setIsCorrectPlaying(false);

      a.play().catch(() => {});
      return;
    }

    const base = getApiBase();
    const r = await fetch(`${base}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, accent: accentUi, rate: 0.98 }),
    });

    if (!r.ok) return;

    const buf = await r.arrayBuffer();
    const blob = new Blob([buf], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);

    // cleanup old url
    try { if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current); } catch {}
    ttsUrlRef.current = url;
    // ✅ store in cache so next time is instant
ttsCacheRef.current.set(ttsCacheKey, url);

    a.pause();
    a.currentTime = 0;
    a.src = url;
    a.volume = settings?.soundEnabled === false ? 0 : 1;
applyPlaybackSettings(a);
attachLoopHandler(a);
if (loopOnRef.current) enableLoopWindow(a);

    a.onplay = () => setIsCorrectPlaying(true);
    a.onpause = () => setIsCorrectPlaying(false);
    a.onended = () => setIsCorrectPlaying(false);
    a.onerror = () => setIsCorrectPlaying(false);

    a.play().catch(() => {});
  } catch {}
}
async function playExampleTts(word) {
  const w = String(word || "").trim();
  if (!w) return;

  const key = `${accentUi}|${w}`;
  const cache = exampleTtsCacheRef.current;

  try {
    if (!exampleAudioRef.current) exampleAudioRef.current = new Audio();
    const a = exampleAudioRef.current;

    // stop current
    try { a.pause(); } catch {}
    try { a.currentTime = 0; } catch {}

    // ✅ if cached -> play instantly
    const cachedUrl = cache.get(key);
    if (cachedUrl) {
      a.src = cachedUrl;
      a.volume = settings?.soundEnabled === false ? 0 : 1;
      a.play().catch(() => {});
      return;
    }

    // cleanup previous (single) url ref (keep it if you want; not required anymore)
    try {
      if (exampleUrlRef.current) URL.revokeObjectURL(exampleUrlRef.current);
    } catch {}
    exampleUrlRef.current = null;

    // fetch TTS once
    const base = getApiBase();
    const r = await fetch(`${base}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: w, accent: accentUi, rate: 1.0 }),
    });
    if (!r.ok) return;

    const buf = await r.arrayBuffer();
    const blob = new Blob([buf], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);

    // ✅ store in cache
    cache.set(key, url);

    // play
    a.src = url;
    a.volume = settings?.soundEnabled === false ? 0 : 1;
    a.play().catch(() => {});
  } catch {}
}
async function prefetchExampleTts(words) {
  const list = Array.isArray(words) ? words : [];
  if (!list.length) return;

  const cache = exampleTtsCacheRef.current;
  const base = getApiBase();

  for (const w0 of list) {
    const w = String(w0 || "").trim();
    if (!w) continue;

    const key = `${accentUi}|${w}`;
    if (cache.has(key)) continue;

    try {
      const r = await fetch(`${base}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: w, accent: accentUi, rate: 1.0 }),
      });
      if (!r.ok) continue;

      const buf = await r.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);

      cache.set(key, url);
    } catch {
      // ignore single failures
    }
  }
}
async function prefetchTtsText(text, rate = 0.98) {
  const t = String(text || "").trim();
  if (!t) return;

  const key = `${accentUi}|${rate}|${t}`;
  const cache = ttsCacheRef.current;
  if (cache.has(key)) return;

  let base = "";
  try {
    base = getApiBase();
  } catch {
    return;
  }

  try {
    const r = await fetch(`${base}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t, accent: accentUi, rate }),
    });
    if (!r.ok) return;

    const buf = await r.arrayBuffer();
    const blob = new Blob([buf], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);

    cache.set(key, url);
  } catch {
    // ignore
  }
}

async function prefetchTtsBatch(texts, rate = 0.98) {
  const arr = Array.isArray(texts) ? texts : [];
  for (const t of arr) {
    // sequential on purpose (avoid spamming your server)
    // eslint-disable-next-line no-await-in-loop
    await prefetchTtsText(t, rate);
  }
}

function getFirstTipKeyForWord(wordObj) {
  const ps = Array.isArray(wordObj?.phonemes) ? wordObj.phonemes : [];
  const wordScore = getScore(wordObj);

  const rawScores = ps.map(getScore).filter((x) => Number.isFinite(x));

  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const code = getPhonemeCode(p);
    if (!code) continue;

    const raw = getScore(p);
    const s = normalizePhonemeScore(raw, wordScore, rawScores);
const assets = resolvePhonemeAssets(code);
const hasTip = (!!assets?.videoSrc || !!assets?.imageSrc) && (s == null || !isGreen(s));


    if (hasTip) return `${code}_${i}`;
  }

  return null;
}

function getExamplesForPhoneme(code) {
  const c = String(code || "").trim().toUpperCase();
  const arr = PHONEME_EXAMPLES?.[c];
  return Array.isArray(arr) ? arr : [];
}

function onTryAgain() {
    stopABNow();

  const t = String(target || "").trim();
  if (!t) return;

  // ✅ luk overlay og gør klar til ny optagelse
  setResult(null);
  setStatus("");
  setSelectedWordIdx(-1);
  setExpandedPhonemeKey(null);
  setWordsOpen(false);
  setSlideIdx(0);
setIntroPhase("idle");
setIntroPct(0);
setIntroStep(0);
clearIntroTimers();



  // stop evt. igangværende lyd (så den ikke føles som “correct” spiller igen)
  try { overlayAudioRef.current?.pause?.(); } catch {}
  try { if (ttsAudioRef.current) ttsAudioRef.current.pause(); } catch {}
  setIsUserPlaying(false);
  setIsCorrectPlaying(false);

  }


function onNext() {
    stopABNow();

  // nyt target + luk overlay (result=null) så du er klar til at optage igen
  const next = buildNewTarget(mode, difficulty);
  setTarget(next);
  setResult(null);
  setStatus("");
  setSelectedWordIdx(-1);
  setExpandedPhonemeKey(null);
  setWordsOpen(false);
  setSlideIdx(0);
setIntroPhase("idle");
setIntroPct(0);
setIntroStep(0);
clearIntroTimers();


  }

function getOverallFromResult(r) {
  const raw =
    r?.overall ??
    r?.overallAccuracy ??
    r?.pronunciation ??
    r?.overall_score ??
    r?.overall_accuracy ??
    r?.pronunciation_score ??
    r?.pronunciation_accuracy ??
    r?.accuracyScore ??
    r?.accuracy_score;

  let n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n <= 1) n = n * 100;
  return Math.round(n);
}

function overallLabel(n) {
  if (n == null) return "Needs work.";
  if (n >= 85) return "Great.";
  if (n >= 70) return "Ok";
  return "Needs work.";
}

  /* ---------------- styles ---------------- */
  const bigCardStyle = {
    background: LIGHT_SURFACE,
    border: `1px solid ${LIGHT_BORDER}`,
    borderRadius: 22,
    boxShadow: LIGHT_SHADOW,
    padding: 18,
    width: "100%",
    maxWidth: 520,
    margin: "0 auto",
  };

const stack = {
  display: "grid",
  gap: 30,
  marginTop: 12,
};

const pickerRow = {
  display: "grid",
  gridTemplateColumns: "56px 1fr 56px",
  alignItems: "center",
  gap: 10,
};

const pickerBtn = {
  width: 56,
  height: 56,
  borderRadius: 18,
  border: `1px solid ${LIGHT_BORDER}`,
  background: "transparent",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

const pickerCenter = {
  textAlign: "center",
  fontWeight: 950,
  fontSize: 28, // ✅ meget større
  color: LIGHT_TEXT,
  lineHeight: 1.05,
};

  const selectWrapStyle = { position: "relative", width: "100%" };

  const selectStyle = {
    height: 48,
    borderRadius: 16,
    padding: "0 14px",
    fontWeight: 900,
    color: LIGHT_TEXT,
    background: "rgba(17,24,39,0.04)",
    border: `1px solid ${LIGHT_BORDER}`,
    outline: "none",
    cursor: "pointer",
    appearance: "none",
    paddingRight: 40,
    width: "100%",
  };

  const chevronStyle = {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: LIGHT_MUTED,
    pointerEvents: "none",
  };

  const startBtnStyle = {
    height: 46,
    padding: "0 18px",
    borderRadius: 16,
    border: "none",
    background: BTN_BLUE,
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    justifySelf: "center",
    width: 140,
  };

  const speakingCardStyle = {
    ...bigCardStyle,
    minHeight: 220,
    display: "grid",
    placeItems: "center",
    gap: 12,
  };

return (
  <div
    className="page"
    style={{
      position: "relative",
      minHeight: "100vh",
      background: "#2196F3",
      paddingBottom: 0,
      display: "flex",
      flexDirection: "column",
      color: LIGHT_TEXT,
    }}
  >
    {/* Force blue backdrop even if parent/shell paints background */}
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        background: "#2196F3",
        zIndex: 0,
      }}
    />

    <div
      style={{
        position: "relative",
        zIndex: 1,
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Blue header (only title lives here) */}
      <div
        style={{
maxWidth: 520,
          margin: "0 auto",
          padding: `calc(${SAFE_TOP} + 18px) 16px 18px`,
          color: "white",
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -0.4 }}>Talk Coach</div>
      </div>

      {/* White sheet under blue header */}
      <div
        style={{
          flex: 1,
          background: "#FFFFFF",
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          boxShadow: "0 -1px 0 rgba(255,255,255,0.10), 0 18px 40px rgba(0,0,0,0.10)",
          padding: "24px 16px 16px",
          paddingBottom: `calc(${TABBAR_OFFSET}px + 16px + ${SAFE_BOTTOM})`,
        }}
      >
        <div className="mx-auto w-full" style={{ maxWidth: 520 }}>

        <LayoutGroup>
          <AnimatePresence mode="wait">
            {stage === "setup" ? (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
style={{
  background: "transparent",
  border: "none",
  boxShadow: "none",
  padding: 0,
}}
              >
                <div style={stack}>
                 
<div style={pickerRow}>
  <button
    type="button"
    onClick={() => setMode((v) => cycleValue(MODE_OPTIONS, v, -1))}
    style={pickerBtn}
    aria-label="Previous mode"
  >
    <ChevronLeft className="h-7 w-7" />
  </button>

  <div style={pickerCenter}>{MODE_LABEL[mode] || "—"}</div>

  <button
    type="button"
    onClick={() => setMode((v) => cycleValue(MODE_OPTIONS, v, 1))}
    style={pickerBtn}
    aria-label="Next mode"
  >
    <ChevronRight className="h-7 w-7" />
  </button>
</div>

<div style={pickerRow}>
  <button
    type="button"
    onClick={() => setDifficulty((v) => cycleValue(DIFF_OPTIONS, v, -1))}
    style={pickerBtn}
    aria-label="Previous difficulty"
  >
    <ChevronLeft className="h-7 w-7" />
  </button>

  <div style={pickerCenter}>{DIFF_LABEL[difficulty] || "—"}</div>

  <button
    type="button"
    onClick={() => setDifficulty((v) => cycleValue(DIFF_OPTIONS, v, 1))}
    style={pickerBtn}
    aria-label="Next difficulty"
  >
    <ChevronRight className="h-7 w-7" />
  </button>
</div>

<div style={pickerRow}>
  <button
    type="button"
    onClick={() => setAccentUi((v) => cycleValue(ACCENT_OPTIONS, v, -1))}
    style={pickerBtn}
    aria-label="Previous accent"
  >
    <ChevronLeft className="h-7 w-7" />
  </button>

  <div style={pickerCenter}>{ACCENT_LABEL[accentUi] || "—"}</div>

  <button
    type="button"
    onClick={() => setAccentUi((v) => cycleValue(ACCENT_OPTIONS, v, 1))}
    style={pickerBtn}
    aria-label="Next accent"
  >
    <ChevronRight className="h-7 w-7" />
  </button>
</div>


                  <button type="button" onClick={onStart} style={startBtnStyle}>
                    Start
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="flow"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
               style={{
  background: "transparent",
  border: "none",
  boxShadow: "none",
  padding: 0,
}}

              >
                <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={onBack}
                    disabled={isBusy}
                    style={{
                      height: 38,
                      padding: "0 12px",
                      borderRadius: 14,
                      border: `1px solid ${LIGHT_BORDER}`,
                      background: LIGHT_SURFACE,
                      fontWeight: 900,
                      color: LIGHT_TEXT,
                      cursor: isBusy ? "not-allowed" : "pointer",
                      opacity: isBusy ? 0.6 : 1,
                    }}
                  >
                    Back
                  </button>
                </div>

                <motion.div
                  style={{ textAlign: "center", fontWeight: 900, fontSize: 22 }}
                  animate={isSpeakingTarget ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={isSpeakingTarget ? { duration: 0.55, ease: "easeOut" } : { duration: 0.12 }}
                >
                  <span style={{ position: "relative", display: "inline-block", padding: "2px 10px", borderRadius: 14 }}>
                    {isSpeakingTarget ? (
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          inset: -12,
                          borderRadius: 18,
                          background: "rgba(33,150,243,0.14)",
                          filter: "blur(12px)",
                          zIndex: 0,
                        }}
                      />
                    ) : null}
                    <span
  style={{
    position: "relative",
    zIndex: 1,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
  }}
>
  <span>{target || "—"}</span>

  <button
    type="button"
    onClick={toggleCorrectTts}
    disabled={!String(target).trim()}
    title="Play pronunciation"
    style={{
      width: 34,
      height: 34,
      borderRadius: 12,
      border: `1px solid ${LIGHT_BORDER}`,
      background: "#fff",
      display: "grid",
      placeItems: "center",
      cursor: String(target).trim() ? "pointer" : "not-allowed",
      opacity: String(target).trim() ? 1 : 0.6,
    }}
  >
    <Volume2 className="h-5 w-5" />
  </button>
</span>
                  </span>
                </motion.div>

                <div style={{ display: "grid", placeItems: "center", marginTop: 52 }}>
                <motion.div
  key="mic"
  initial={{ opacity: 0, y: 6, scale: 0.98 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ duration: 0.18 }}
>
  <button
    type="button"
    onClick={toggleRecord}
    disabled={isAnalyzing || !target}
    title={isRecording ? "Stop" : "Record"}
    style={{
      width: 52,
      height: 52,
      borderRadius: 18,
      border: "none",
      background: isRecording ? "#111827" : BTN_BLUE,
      display: "grid",
      placeItems: "center",
      cursor: isAnalyzing ? "not-allowed" : "pointer",
      opacity: isAnalyzing ? 0.6 : 1,
    }}
  >
    {isRecording ? (
      <StopCircle className="h-6 w-6" style={{ color: "white" }} />
    ) : (
      <Mic className="h-6 w-6" style={{ color: "white" }} />
    )}
  </button>
</motion.div>



                  <div style={{ marginTop: 10, minHeight: 18, color: LIGHT_MUTED, fontWeight: 800, fontSize: 12 }}>
                    {isRecording ? "Recording…" : isAnalyzing ? "Analyzing…" : status || " "}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        {/* ✅ Overlay-only: appears after we have result */}
{stage === "flow" && result
  ? createPortal(
      <div
        style={{
  position: "fixed",
  inset: 0,
  height: "100dvh",
  background: "#2196F3",
  zIndex: 20000,      // ✅ over tabbar
  overflow: "hidden", // ✅ som i Practice
}}

      >
           

              <div
                style={{
                  maxWidth: 520,
                  margin: "0 auto",
                  display: "grid",
                  gap: 12,
                }}
              >
        

{/* ---------- 3-card slider (INNER CARD WRAPPER) ---------- */}
<div
style={{
  background: "transparent",
  border: "none",
  boxShadow: "none",
  padding: 0,
  borderRadius: 0,
}}

>




{/* ---------- 3-card slider ---------- */}
<div style={{ marginTop: 18 }}>
  {/* content area (scrollable) */}
  <div style={{ paddingBottom: 88 }}>
    <AnimatePresence mode="wait">
      <motion.div
        key={`swipe_${activeSlide?.key || "x"}`}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.16 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          const dx = info?.offset?.x || 0;
          const TH = 60;

         if (dx > TH) {
  stopAllAudio();
  setSlideIdx((i) => Math.max(0, i - 1));
} else if (dx < -TH) {
  stopAllAudio();
  setSlideIdx((i) => Math.min(totalSlides - 1, i + 1));
}
          setDeepDiveOpen(false);
          setVideoMuted(true);
          try {
            const v = videoRef.current;
            if (v) {
              v.pause();
              v.currentTime = 0;
            }
          } catch {}
        }}
        style={{ marginTop: 8 }}
      >
{activeSlide?.type === "intro" ? (() => {
  const o = overallPct;
  const label = overallLabel(o);
  const pct = introPct; // (tæller stadig op, men ser ens ud når den står stille)
  const word = String(target || "—").trim();
  const red = scoreColor(o);

  return (
    <div
      style={{
        minHeight: "calc(100dvh - 150px)",
        display: "grid",
        placeItems: "center",
        paddingTop: `calc(${SAFE_TOP} + 10px)`,
        paddingBottom: `calc(90px + ${SAFE_BOTTOM})`,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontWeight: 950,
            fontSize: 92,
            color: red,
            lineHeight: 0.92,
            letterSpacing: -0.6,
            textShadow: "0 10px 26px rgba(0,0,0,0.18)",
          }}
        >
          {word}
        </div>

        <div
          style={{
            marginTop: 6,
            fontWeight: 950,
            fontSize: 72,
            color: red,
            lineHeight: 0.95,
            textShadow: "0 10px 26px rgba(0,0,0,0.18)",
          }}
        >
          {pct}%
        </div>

        <div
          style={{
            marginTop: 14,
            fontWeight: 850,
            fontSize: 18,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
})() : null}






{activeSlide?.type === "phoneme" ? (
  !activeSlide?.code ? (
    <div style={{ marginTop: 12, color: LIGHT_MUTED, fontWeight: 800 }}>No data for this phoneme.</div>
  ) : (
    <div
      style={{
        marginTop: 10,
        background: "#0B1220",
        borderRadius: 28,
        padding: 18,
        color: "white",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* X (top-right) -> back to Overview */}
      <button
        type="button"
        onClick={() => {
          setDeepDiveOpen(false);
          setVideoMuted(true);
          try {
            const v = videoRef.current;
            if (v) {
              v.pause();
              v.currentTime = 0;
            }
          } catch {}
          setSlideIdx(0);
        }}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 14,
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
          fontWeight: 900,
          fontSize: 18,
        }}
      >
        ×
      </button>

      {/* Title + desc */}
      <div style={{ paddingRight: 60 }}>
        <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: -0.5 }}>
          {getPhonemeUiCopy(activeSlide.code).title}
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 15.5,
            lineHeight: 1.35,
            color: "rgba(255,255,255,0.72)",
            fontWeight: 650,
          }}
        >
          {getPhonemeUiCopy(activeSlide.code).desc}
        </div>
      </div>

    {/* Media (video preferred, image fallback) */}
<div style={{ marginTop: 16, borderRadius: 22, overflow: "hidden", position: "relative", background: "black" }}>
  <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10" }}>
    {activeSlide.assets?.videoSrc && !badVideoByCode[activeSlide.code] ? (
      <>
        <video
          ref={videoRef}
          src={activeSlide.assets?.videoSrc}
          playsInline
          muted={videoMuted}
          preload="auto"
          onError={() => setBadVideoByCode((m) => ({ ...m, [activeSlide.code]: true }))}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />

        {/* mute icon (top-right) */}
        <button
          type="button"
          onClick={() => {
            setVideoMuted((m) => {
              const next = !m;
              try {
                const v = videoRef.current;
                if (v) v.muted = next;
              } catch {}
              return next;
            });
          }}
          aria-label="Mute"
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            width: 44,
            height: 44,
            borderRadius: 22,
            border: "none",
            background: "rgba(0,0,0,0.35)",
            color: "white",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <Volume2 className="h-5 w-5" />
        </button>

        {/* play (center) */}
        <button
          type="button"
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            try {
              v.muted = false;
              setVideoMuted(false);
              v.currentTime = 0;
              v.play().catch(() => {});
            } catch {}
          }}
          aria-label="Play"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 78,
            height: 78,
            borderRadius: 39,
            border: "none",
            background: "rgba(255,255,255,0.95)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <Play className="h-8 w-8" style={{ color: "#0B1220" }} />
        </button>
      </>
    ) : activeSlide.assets?.imageSrc && !badImageByCode[activeSlide.code] ? (
      <img
        src={activeSlide.assets?.imageSrc}
        alt={`${activeSlide.code} diagram`}
        onError={() => setBadImageByCode((m) => ({ ...m, [activeSlide.code]: true }))}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "black" }}
      />
    ) : (
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.70)", fontWeight: 800 }}>
        Missing media for {activeSlide.code}
      </div>
    )}
  </div>
</div>


      {/* ONLY card/pill allowed: Watch Deep Dive */}
      <button
        type="button"
        onClick={() => setDeepDiveOpen(true)}
        style={{
          marginTop: 16,
          width: "100%",
          height: 56,
          borderRadius: 999,
          border: "none",
          background: "rgba(255,255,255,0.14)",
          color: "white",
          fontWeight: 950,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        Watch Deep Dive <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
      </button>


      {/* Deep Dive modal (samme som før) */}
      {deepDiveOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10050,
            background: "rgba(0,0,0,0.75)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#0B1220",
              borderRadius: 28,
              overflow: "hidden",
              position: "relative",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setDeepDiveOpen(false);
                try {
                  const v = videoRef.current;
                  if (v) {
                    v.pause();
                    v.currentTime = 0;
                  }
                } catch {}
              }}
              aria-label="Close deep dive"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 44,
                height: 44,
                borderRadius: 22,
                border: "none",
                background: "rgba(255,255,255,0.10)",
                color: "white",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                fontWeight: 900,
                fontSize: 18,
                zIndex: 2,
              }}
            >
              ×
            </button>

            <div style={{ padding: 16, paddingTop: 18, color: "white" }}>
              <div style={{ fontSize: 28, fontWeight: 950 }}>
                {getPhonemeUiCopy(activeSlide.code).title}
              </div>
              <div style={{ marginTop: 6, color: "rgba(255,255,255,0.72)", fontWeight: 650 }}>
                {getPhonemeUiCopy(activeSlide.code).desc}
              </div>
            </div>

            <div style={{ width: "100%", aspectRatio: "16 / 10", background: "black" }}>
              <video
                src={activeSlide.assets?.videoSrc || ""}
                playsInline
                controls
                autoPlay
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
) : null}



{activeSlide?.type === "playback" ? (
  <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
    <div
      style={{
        borderRadius: 22,
        border: `1px solid ${LIGHT_BORDER}`,
        background: LIGHT_SURFACE,
        boxShadow: LIGHT_SHADOW,
        padding: 14,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ fontWeight: 950, fontSize: 14 }}>Playback</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          type="button"
          onClick={toggleUserRecording}
          disabled={!result?.userAudioUrl}
          style={{
            height: 44,
            borderRadius: 16,
            border: `1px solid ${LIGHT_BORDER}`,
            background: "rgba(17,24,39,0.04)",
            fontWeight: 950,
            cursor: result?.userAudioUrl ? "pointer" : "not-allowed",
            opacity: result?.userAudioUrl ? 1 : 0.5,
          }}
        >
          {isUserPlaying ? "Pause You" : "Play You"}
        </button>

        <button
          type="button"
          onClick={toggleCorrectTts}
          disabled={!String(isSentence ? target : currentWordText).trim()}
          style={{
            height: 44,
            borderRadius: 16,
            border: `1px solid ${LIGHT_BORDER}`,
            background: "rgba(17,24,39,0.04)",
            fontWeight: 950,
            cursor: String(isSentence ? target : currentWordText).trim() ? "pointer" : "not-allowed",
            opacity: String(isSentence ? target : currentWordText).trim() ? 1 : 0.5,
          }}
        >
          {isCorrectPlaying ? "Pause Correct" : "Play Correct"}
        </button>
      </div>

      <button
        type="button"
        onClick={toggleABCompare}
        disabled={!result?.userAudioUrl || !String(isSentence ? target : currentWordText).trim()}
        style={{
          height: 44,
          borderRadius: 16,
          border: `1px solid ${LIGHT_BORDER}`,
          background: "rgba(17,24,39,0.04)",
          fontWeight: 950,
          cursor: result?.userAudioUrl ? "pointer" : "not-allowed",
          opacity: result?.userAudioUrl ? 1 : 0.5,
        }}
      >
        {isABPlaying ? "Stop A/B Compare" : "A/B Compare"}
      </button>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[1.0, 0.85, 0.75].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setPlaybackRate(r)}
              style={{
                height: 38,
                padding: "0 12px",
                borderRadius: 999,
                border: `1px solid ${LIGHT_BORDER}`,
                background: playbackRate === r ? "rgba(33,150,243,0.14)" : "rgba(17,24,39,0.04)",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              {r}x
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setLoopOn((v) => !v)}
          style={{
            height: 44,
            borderRadius: 16,
            border: `1px solid ${LIGHT_BORDER}`,
            background: loopOn ? "rgba(33,150,243,0.14)" : "rgba(17,24,39,0.04)",
            fontWeight: 950,
            cursor: "pointer",
          }}
        >
          {loopOn ? "Loop: ON" : "Loop: OFF"}
        </button>
      </div>
    </div>
  </div>
) : null}


{activeSlide?.type === "actions" ? (
  <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
    <div
      style={{
        borderRadius: 22,
        border: `1px solid ${LIGHT_BORDER}`,
        background: LIGHT_SURFACE,
        boxShadow: LIGHT_SHADOW,
        padding: 14,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 950, fontSize: 14 }}>Actions</div>

      <button
        type="button"
        onClick={onTryAgain}
        style={{
          height: 46,
          borderRadius: 16,
          border: `1px solid ${LIGHT_BORDER}`,
          background: "rgba(17,24,39,0.04)",
          fontWeight: 950,
          cursor: "pointer",
        }}
      >
        Try again
      </button>

      <button
        type="button"
        onClick={onNext}
        style={{
          height: 46,
          borderRadius: 16,
          border: "none",
          background: BTN_BLUE,
          color: "white",
          fontWeight: 950,
          cursor: "pointer",
        }}
      >
        Next
      </button>
    </div>
  </div>
) : null}

      </motion.div>
    </AnimatePresence>
<div
  style={{
  position: "fixed",
  left: "50%",
  transform: "translateX(-50%)",
  width: "100%",
  maxWidth: 520,                 // ✅ matcher indholdets bredde
  bottom: `calc(36px + ${SAFE_BOTTOM})`,
  zIndex: 10010,
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  padding: "0 22px",
  pointerEvents: "none",
}}

>
  <div style={{ justifySelf: "start", pointerEvents: "auto" }}>
    <button
      type="button"
      onClick={() => {
        stopAllAudio();
        setSlideIdx((i) => Math.max(0, i - 1));
        setDeepDiveOpen(false);
        setVideoMuted(true);
        try {
          const v = videoRef.current;
          if (v) {
            v.pause();
            v.currentTime = 0;
          }
        } catch {}
      }}
      disabled={slideIdx <= 0}
      aria-label="Previous"
      style={{
        width: 56,
        height: 56,
        borderRadius: 18,
        border: "none",
        background: "rgba(255,255,255,0.14)",
        display: "grid",
        placeItems: "center",
        cursor: slideIdx <= 0 ? "not-allowed" : "pointer",
        opacity: slideIdx <= 0 ? 0.35 : 1,
      }}
    >
      <ChevronLeft className="h-7 w-7" style={{ color: "white" }} />
    </button>
  </div>

  {/* ✅ Kun "1/6" – ingen ekstra tekst */}
  <div style={{ textAlign: "center", pointerEvents: "none" }}>
    <div style={{ fontSize: 16, fontWeight: 950, color: "white", lineHeight: 1 }}>
      {slideIdx + 1}/{totalSlides}
    </div>
  </div>

  <div style={{ justifySelf: "end", pointerEvents: "auto" }}>
    <button
      type="button"
      onClick={() => {
        stopAllAudio();
        setSlideIdx((i) => Math.min(totalSlides - 1, i + 1));
        setDeepDiveOpen(false);
        setVideoMuted(true);
        try {
          const v = videoRef.current;
          if (v) {
            v.pause();
            v.currentTime = 0;
          }
        } catch {}
      }}
      disabled={slideIdx >= totalSlides - 1}
      aria-label="Next"
      style={{
        width: 56,
        height: 56,
        borderRadius: 18,
        border: "none",
        background: "rgba(255,255,255,0.14)",
        display: "grid",
        placeItems: "center",
        cursor: slideIdx >= totalSlides - 1 ? "not-allowed" : "pointer",
        opacity: slideIdx >= totalSlides - 1 ? 0.35 : 1,
      }}
    >
      <ChevronRight className="h-7 w-7" style={{ color: "white" }} />
    </button>
  </div>
</div>

  </div>
</div>




                </div>
              </div>
            </div>,
      document.body
    )
  : null}
        </LayoutGroup>

               <audio ref={ttsAudioRef} playsInline preload="auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
