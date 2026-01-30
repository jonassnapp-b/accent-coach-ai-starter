// src/pages/Coach.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { ChevronDown, Mic, StopCircle, Volume2, Play, Pause } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useSettings } from "../lib/settings-store.jsx";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";
import { ingestLocalPhonemeScores } from "../lib/localPhonemeStats.js";
import PHONEME_EXAMPLES from "../data/phonemeExamples.json";

const IS_PROD = !!import.meta?.env?.PROD;

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
const AVAILABLE_IMAGES = new Set([
  // vowels (as per your images folder)
  "AA", "AH", "AO", "AX", "AY", "EH", "EY", "IH", "IX", "IY", "OH", "OY", "UH", "UW", "UX",

  // consonants (as per your images folder)
  "B", "CH", "D", "DH", "F", "G", "HH", "JH", "K", "L", "M", "N", "P", "R", "SH", "T", "TH", "V", "W", "Y", "ZH",
]);

const AVAILABLE_AUDIO_BR = new Set([
  // vowels (as per your en_br audio folder)
  "AA", "AH", "AO", "AX", "AY", "EH", "EY", "IH", "IX", "IY", "OH", "OY", "UH", "UW", "UX",

  // consonants (as per your en_br audio folder)
  "B", "CH", "D", "F", "G", "HH", "JH", "K", "L", "M", "N", "P", "R", "SH", "T", "TH", "V", "W", "Y", "ZH",
]);

const AVAILABLE_AUDIO_US = new Set([
  // you only have AO_us.mp3 in en_us
  "AO",
]);


function resolvePhonemeAssets(code, accentUi) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;

  const imgOk = AVAILABLE_IMAGES.has(c);
  const imgSrc = imgOk ? `/phonemes/images/${c}.png` : null;

  // audio:
  // - if en_us and we have US version -> use that
  // - else fallback to en_br if we have it
  let audioSrc = null;

  if (accentUi === "en_us" && AVAILABLE_AUDIO_US.has(c)) {
    // special filename for US:
    if (c === "AO") audioSrc = `/phonemes/audio/en_us/AO_us.mp3`;
  } else if (AVAILABLE_AUDIO_BR.has(c)) {
    audioSrc = `/phonemes/audio/en_br/${c}.mp3`;
  }

  // If either missing, we still allow showing image-only or audio-only?
  // You asked: "overskrift + billede + lyd-knap under billed med lyd"
  // => we require image, and audio is optional (button shown only if audio exists).
  if (!imgSrc) return null;

  return { imgSrc, audioSrc };
}

/* ---------------- SpeechSuper parsing helpers ---------------- */
function getPhonemeCode(p) {
  return String(p?.phoneme || p?.ipa || p?.symbol || "").trim().toUpperCase();
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

  // dropdown state
  const [mode, setMode] = useState("words"); // words | sentences
  const [difficulty, setDifficulty] = useState("easy"); // easy | medium | hard
  const [accentUi, setAccentUi] = useState(settings?.accentDefault || "en_us");

  useEffect(() => {
    setAccentUi(settings?.accentDefault || "en_us");
  }, [settings?.accentDefault]);

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
const [wordsOpen, setWordsOpen] = useState(false); // ✅ dropdown open/closed

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

// play/pause state for the big play buttons
const [isUserPlaying, setIsUserPlaying] = useState(false);
const [isCorrectPlaying, setIsCorrectPlaying] = useState(false);

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

    try { if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current); } catch {}
    ttsUrlRef.current = null;

    setIsSpeaking(false);
    setIsSpeakingTarget(false);
    setIsCorrectPlaying(false);

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
setIsUserPlaying(false);
setIsCorrectPlaying(false);

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

      const r = await fetch(`${base}/api/analyze-speech`, { method: "POST", body: fd });
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
      setIsUserPlaying(false);
setIsCorrectPlaying(false);

setExpandedPhonemeKey(null);

// ✅ if sentence: show list, but keep ALL rows collapsed
if ((mode === "sentences") || ((payload?.words?.length || 0) > 1)) {
  setWordsOpen(true);        // list visible
  setSelectedWordIdx(-1);    // ✅ NONE opened
} else {
  setWordsOpen(false);       // no list in single-word mode
  setSelectedWordIdx(0);     // single-word mode uses currentWordObj
}



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
      const threshold = difficulty === "easy" ? 75 : difficulty === "medium" ? 82 : 88;

    if (overall >= threshold + 7) {
  setStatus("Well done ✅");
  const next = buildNewTarget(mode, difficulty);
  setTarget(next);
  // don't auto-speak
} else if (overall >= threshold) {
  setStatus("That’s alright — next 👌");
  const next = buildNewTarget(mode, difficulty);
  setTarget(next);
  // don't auto-speak
} else {
  setStatus("Try again (listen to the feedback) 🔁");
}

    } catch (e) {
      setStatus(IS_PROD ? "Something went wrong. Try again." : e?.message || String(e));
    } finally {
      setIsAnalyzing(false);
    }
  }

  /* ---------------- overlay data ---------------- */
  const words = useMemo(() => normalizeWordsFromResult(result, target), [result, target]);
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

    const assets = resolvePhonemeAssets(code, accentUi);

    out.push({
      key: `${code}_${i}`,
      code,
      score: s,          // ✅ normalized (kun til farve/visuelt)
      rawScore: raw,     // (hvis du senere vil bruge den)
      assets,
      hasImage: !!assets?.imgSrc,
      hasTip: !!assets?.imgSrc && (s == null || !isGreen(s)), // ✅ baseret på normalized
    });
  }

  return out;
}, [currentWordObj, accentUi, currentWordScore]);


const tipItems = useMemo(() => phonemeLineItems.filter((x) => x.hasTip), [phonemeLineItems]);

const expandedTip = useMemo(() => {
  if (!expandedPhonemeKey) return null;
  return tipItems.find((x) => x.key === expandedPhonemeKey) || null;
}, [expandedPhonemeKey, tipItems]);


function toggleOverlayAudio(src, kind) {
  if (!src) return;

  try {
    if (!overlayAudioRef.current) overlayAudioRef.current = new Audio();
    const a = overlayAudioRef.current;

    const isSameSrc = userSrcRef.current === src;

    // If same src and currently playing -> pause
    if (isSameSrc && !a.paused && !a.ended) {
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

    a.play().catch(() => {});
  } catch {}
}

function toggleUserRecording() {
  if (!result?.userAudioUrl) return;
  toggleOverlayAudio(result.userAudioUrl, "user");
}

async function toggleCorrectTts() {
  const text = String(isSentence ? target : currentWordText).trim();
  if (!text) return;

  const a = ttsAudioRef.current;
  if (!a) return;

  const sameText = correctTextRef.current === text;

  // If same text and currently playing -> pause
 if (sameText && a.src) {
  // restart immediately (even mid-play)
  try {
    a.pause();
    a.currentTime = 0;
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

    a.pause();
    a.currentTime = 0;
    a.src = url;
    a.volume = settings?.soundEnabled === false ? 0 : 1;

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


function getExamplesForPhoneme(code) {
  const c = String(code || "").trim().toUpperCase();
  const arr = PHONEME_EXAMPLES?.[c];
  return Array.isArray(arr) ? arr : [];
}

function onTryAgain() {
  const t = String(target || "").trim();
  if (!t) return;

  // ✅ luk overlay og gør klar til ny optagelse
  setResult(null);
  setStatus("");
  setSelectedWordIdx(-1);
  setExpandedPhonemeKey(null);
  setWordsOpen(false);

  // stop evt. igangværende lyd (så den ikke føles som “correct” spiller igen)
  try { overlayAudioRef.current?.pause?.(); } catch {}
  try { if (ttsAudioRef.current) ttsAudioRef.current.pause(); } catch {}
  setIsUserPlaying(false);
  setIsCorrectPlaying(false);

  }


function onNext() {
  // nyt target + luk overlay (result=null) så du er klar til at optage igen
  const next = buildNewTarget(mode, difficulty);
  setTarget(next);
  setResult(null);
  setStatus("");
  setSelectedWordIdx(-1);
  setExpandedPhonemeKey(null);
  setWordsOpen(false);

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

  const stack = { display: "grid", gap: 30 };

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
    <div className="page" style={{ minHeight: "100vh", background: LIGHT_BG, color: LIGHT_TEXT }}>
      <div className="mx-auto w-full" style={{ maxWidth: 720, padding: "14px 12px 8px" }}>
        <div style={{ textAlign: "center", fontWeight: 900, fontSize: 18, color: LIGHT_TEXT }}>Talk Coach</div>
      </div>

      <div
        className="mx-auto w-full"
        style={{
          maxWidth: 720,
          padding: "12px 12px",
          paddingBottom: `calc(${TABBAR_OFFSET}px + 24px)`,
        }}
      >
        <LayoutGroup>
          <AnimatePresence mode="wait">
            {stage === "setup" ? (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                style={bigCardStyle}
              >
                <div style={stack}>
                  <div style={selectWrapStyle}>
                    <select aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value)} style={selectStyle}>
                      <option value="words">Words</option>
                      <option value="sentences">Sentences</option>
                    </select>
                    <ChevronDown className="h-4 w-4" style={chevronStyle} />
                  </div>

                  <div style={selectWrapStyle}>
                    <select
                      aria-label="Difficulty"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                    <ChevronDown className="h-4 w-4" style={chevronStyle} />
                  </div>

                  <div style={selectWrapStyle}>
                    <select
                      aria-label="Accent"
                      value={accentUi}
                      onChange={(e) => setAccentUi(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="en_us">American 🇺🇸</option>
                      <option value="en_br">British 🇬🇧</option>
                    </select>
                    <ChevronDown className="h-4 w-4" style={chevronStyle} />
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
                  background: LIGHT_SURFACE,
                  border: `1px solid ${LIGHT_BORDER}`,
                  borderRadius: 22,
                  boxShadow: LIGHT_SHADOW,
                  padding: 18,
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
          {stage === "flow" && result ? (
            <div
              style={{
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: TABBAR_OFFSET, // ✅ efterlader plads til tabbar
  zIndex: 9999,
  background: LIGHT_BG,
  overflowY: "auto",
  padding: 16,
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
                {/* Header card */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 22,
                    padding: 16,
                    border: `1px solid ${LIGHT_BORDER}`,
                    boxShadow: LIGHT_SHADOW,
                  }}
                >
{isSentence ? (
  <div style={{ marginBottom: 12 }}>
    {/* ONLY the words list. Chevron only when OPEN. */}
    {wordsOpen ? (
      <div style={{ display: "grid", gap: 22 }}>
        {words.map((w, i) => {
          const label = String(w?.word || w?.text || `Word ${i + 1}`).trim();
          const wordObj = w; // ✅ denne rækkes word
const wordText = String(wordObj?.word || wordObj?.text || wordObj?.name || "").trim();
const wordScore = getScore(wordObj);

const rowPhonemeLineItems = (() => {
  const ps = Array.isArray(wordObj?.phonemes) ? wordObj.phonemes : [];
  const out = [];

  const rawScores = ps.map(getScore).filter((x) => Number.isFinite(x));

  for (let pi = 0; pi < ps.length; pi++) {
    const p = ps[pi];
    const code = getPhonemeCode(p);
    if (!code) continue;

    const raw = getScore(p);
    const s = normalizePhonemeScore(raw, wordScore, rawScores);

    const assets = resolvePhonemeAssets(code, accentUi);

    out.push({
      key: `${code}_${pi}`,
      code,
      score: s,          // ✅ normalized
      rawScore: raw,
      assets,
      hasImage: !!assets?.imgSrc,
      hasTip: !!assets?.imgSrc && (s == null || !isGreen(s)), // ✅ baseret på normalized
    });
  }

  return out;
})();


const rowTipItems = rowPhonemeLineItems.filter((x) => x.hasTip);


         return (
  <div key={`${label}_${i}`} style={{ display: "grid", gap: 10 }}>
    <button
      type="button"
      onClick={() => {
        setExpandedPhonemeKey(null);
      setSelectedWordIdx((prev) => (prev === i ? -1 : i));

        // optional: toggle accordion behavior
        // setSelectedWordIdx((prev) => (prev === i ? -1 : i));
      }}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: 44,
          fontWeight: 500,
          color: "rgba(17,24,39,0.55)",
          lineHeight: 1.05,
        }}
      >
        {label}
      </span>

      {/* chevron skal IKKE få listen til at forsvinde */}
      <ChevronDown
        className="h-6 w-6"
        style={{
          color: "rgba(17,24,39,0.55)",
          opacity: 0.9,
          transform: i === selectedWordIdx ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 160ms ease",
        }}
      />
    </button>

    {/* ✅ Accordion feedback UNDER selected word */}
    <AnimatePresence initial={false}>
      {i === selectedWordIdx ? (
        <div style={{ paddingTop: 10 }}>
  {/* Word (colored) */}

  <div style={{ marginTop: 6, textAlign: "left", fontSize: 12, color: LIGHT_MUTED, fontWeight: 800 }}>
    {wordScore == null ? " " : `Score: ${Math.round(wordScore)}`}
  </div>

  {/* Phonemes */}
  <div style={{ marginTop: 12 }}>
    <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
      <span style={{ fontSize: 20, fontWeight: 950, color: "#111827", marginRight: 6 }}>
        Phonemes:
      </span>

      {rowPhonemeLineItems.length ? (
        rowPhonemeLineItems.map((it) => (
          <button
            key={`row_${i}_${it.key}`}
            type="button"
            onClick={() => {
              if (it.hasTip) setExpandedPhonemeKey(`row_${i}_${it.key}`);
              else setExpandedPhonemeKey(null);
            }}
            disabled={!it.hasTip}
            title={it.hasTip ? "Select for tip" : it.hasImage ? "No tip needed (green)" : "No image available"}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: it.hasTip ? "pointer" : "default",
              fontSize: 20,
              fontWeight: 950,
              color: scoreColor(it.score),
              textDecoration: it.hasImage ? "underline" : "none",
              textUnderlineOffset: 6,
              textDecorationThickness: 3,
              opacity: it.hasTip ? 1 : 0.65,
            }}
          >
            {it.code}
          </button>
        ))
      ) : (
        <span style={{ fontSize: 20, fontWeight: 900, color: LIGHT_MUTED }}>—</span>
      )}
    </div>
  </div>

{/* Tip area for this row */}
{(() => {
  if (!rowTipItems.length) {
    return (
      <div
        style={{
          marginTop: 12,
          background: "#fff",
          borderRadius: 22,
          padding: 16,
          border: `1px solid ${LIGHT_BORDER}`,
          boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
          color: LIGHT_MUTED,
          fontWeight: 900,
          textAlign: "center",
        }}
      >
        No tips for this word.
      </div>
    );
  }

  const prefix = `row_${i}_`;
  const rowExpandedLocalKey = expandedPhonemeKey?.startsWith(prefix) ? expandedPhonemeKey.slice(prefix.length) : null;
  const rowExpandedTip = rowExpandedLocalKey ? rowTipItems.find((x) => x.key === rowExpandedLocalKey) : null;
return rowExpandedTip ? (
  <div> ... tip card ... </div>
) : (
  <div style={{ marginTop: 12, fontSize: 12, fontWeight: 800, color: LIGHT_MUTED }}>
    Tap a phoneme above to see a tip.
  </div>
);



})()}

</div>

      ) : null}
    </AnimatePresence>
  </div>
);

        })}
      </div>
    ) : null}
  </div>
) : null}

{!isSentence ? (
  <>

                  {/* Word (colored like main) */}
                  
                {wordOnlyResult ? (
  <PhonemeFeedback
    result={wordOnlyResult}
    embed={true}
    hideBookmark={true}
    mode="wordOnly"
  />
) : (
  <div
    style={{
      fontSize: 34,
      fontWeight: 950,
      lineHeight: 1.1,
      textAlign: "center",
      color: scoreColor(currentWordScore),
    }}
  >
    {currentWordText || "—"}
  </div>
)}




                  <div style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: LIGHT_MUTED, fontWeight: 800 }}>
                    {currentWordScore == null ? " " : `Score: ${Math.round(currentWordScore)}`
                    }
                  </div>
                
                {currentWordObj ? (
  <>
    <div style={{ marginTop: 12, textAlign: "center" }}>
      <div style={{ display: "inline-flex", flexWrap: "wrap", justifyContent: "center", gap: 10, alignItems: "baseline" }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 950,
            color: "#111827",
            marginRight: 6,
          }}
        >
          Phonemes:
        </span>

        {phonemeLineItems.length ? (
          phonemeLineItems.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => {
                if (it.hasTip) setExpandedPhonemeKey(it.key);
                else setExpandedPhonemeKey(null);
              }}
              disabled={!it.hasTip}
              title={it.hasTip ? "Select for tip" : it.hasImage ? "No tip needed (green)" : "No image available"}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: it.hasTip ? "pointer" : "default",
                fontSize: 24,
                fontWeight: 950,
                color: scoreColor(it.score),
                textDecoration: it.hasImage ? "underline" : "none",
                textUnderlineOffset: 6,
                textDecorationThickness: 3,
                opacity: it.hasTip ? 1 : 0.65,
              }}
            >
              {it.code}
            </button>
          ))
        ) : (
          <span style={{ fontSize: 24, fontWeight: 900, color: LIGHT_MUTED }}>—</span>
        )}
      </div>
    </div>

    <div style={{ marginTop: 14 }}>
      {tipItems.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              if (!expandedPhonemeKey) {
                setExpandedPhonemeKey(tipItems[0].key);
                return;
              }
              setExpandedPhonemeKey((prev) => (prev ? null : tipItems[0].key));
            }}
            style={{
              height: 46,
              borderRadius: 16,
              border: `1px solid ${LIGHT_BORDER}`,
              background: "#fff",
              fontWeight: 950,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <ChevronDown
              className="h-5 w-5"
              style={{
                transform: expandedTip ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 160ms ease",
              }}
            />
            {expandedTip ? `Hide tip` : `Show tip`}
          </button>

          {expandedTip ? (
            <div
              style={{
                background: "#fff",
                borderRadius: 22,
                padding: 14,
                border: `1px solid ${LIGHT_BORDER}`,
                boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 950, fontSize: 18, color: LIGHT_TEXT }}>{expandedTip.code}</div>
                <div style={{ fontWeight: 900, fontSize: 12, color: scoreColor(expandedTip.score) }}>
                  {expandedTip.score == null ? "" : Math.round(expandedTip.score)}
                </div>
              </div>

              <div style={{ display: "grid", placeItems: "center" }}>
                <img
                  src={expandedTip.assets.imgSrc}
                  alt={expandedTip.code}
                  style={{
                    width: "100%",
                    maxWidth: 320,
                    height: "auto",
                    borderRadius: 16,
                    border: `1px solid ${LIGHT_BORDER}`,
                    background: "#fff",
                  }}
                />
              </div>

              {expandedTip.assets.audioSrc ? (
                <button
                  type="button"
                  onClick={() => toggleOverlayAudio(expandedTip.assets.audioSrc, "phoneme")}
                  style={{
                    height: 44,
                    borderRadius: 16,
                    border: `1px solid ${LIGHT_BORDER}`,
                    background: "#fff",
                    fontWeight: 950,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    cursor: "pointer",
                  }}
                >
                  <Volume2 className="h-5 w-5" />
                  Play sound
                </button>
              ) : null}
  {getExamplesForPhoneme(expandedTip.code).length ? (
  <div style={{ marginTop: 14 }}>
    <div style={{ fontWeight: 950, fontSize: 14, color: LIGHT_TEXT }}>Examples</div>

    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
      {getExamplesForPhoneme(expandedTip.code).map((w) => (
        <button
          key={`${expandedTip.code}_${w}`}
          type="button"
          onClick={() => playExampleTts(w)}
          style={{
            border: `1px solid ${LIGHT_BORDER}`,
            background: "#fff",
            borderRadius: 14,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <Volume2 className="h-5 w-5" />
          <span style={{ fontWeight: 900 }}>{w}</span>
        </button>
      ))}
    </div>
  </div>
) : null}


            </div>
          ) : null}
        </div>
      ) : (
  <>
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: 16,
        border: `1px solid ${LIGHT_BORDER}`,
        boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
        color: LIGHT_MUTED,
        fontWeight: 900,
        textAlign: "center",
      }}
    >
      No tips for this word.
    </div>

    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      <div style={{ height: 1, background: LIGHT_BORDER, width: "100%" }} />

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: LIGHT_TEXT }}>You</div>
       <button
  type="button"
  onClick={toggleUserRecording}
  disabled={!result?.userAudioUrl}
  title="Play"
  style={{
    width: 84,
    height: 84,
    borderRadius: 22,
    border: `1px solid ${LIGHT_BORDER}`,
    background: "#fff",
    display: "grid",
    placeItems: "center",
    cursor: result?.userAudioUrl ? "pointer" : "not-allowed",
    opacity: result?.userAudioUrl ? 1 : 0.6,
  }}
>
  <Play className="h-10 w-10" />
</button>

      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: LIGHT_TEXT }}>Correct pronunciation</div>
      <button
  type="button"
  onClick={toggleCorrectTts}

  disabled={!String(isSentence ? target : currentWordText).trim()}
  title="Play"
  style={{
    width: 84,
    height: 84,
    borderRadius: 22,
    border: `1px solid ${LIGHT_BORDER}`,
    background: "#fff",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    opacity: String(isSentence ? target : currentWordText).trim() ? 1 : 0.6,
  }}
>
  <Play className="h-10 w-10" />
</button>

      </div>
    </div>
  </>
)}



    </div>
  </>
) : (
  <div style={{ marginTop: 12, textAlign: "center", color: LIGHT_MUTED, fontWeight: 900 }}>
    Tap a word to see feedback.
  </div>
)}

  </>
) : null}
{/* ✅ Global playback (always at bottom, for both words + sentences) */}
<div style={{ marginTop: 36, display: "grid", gap: 28 }}>
  {/* divider with more breathing room */}
  <div style={{ height: 1, background: LIGHT_BORDER, width: "100%", marginTop: 30, marginBottom: 30
 }} />

  {/* You */}
  <div style={{ display: "grid", gap: 10 }}>
    <div style={{ fontSize: 26, fontWeight: 950, color: "#111827", textAlign: "center" }}>You</div>
    <div style={{ display: "flex", justifyContent: "center" }}>
      <button
        type="button"
        onClick={toggleUserRecording}
        disabled={!result?.userAudioUrl}
        title="Play"
        style={{
          width: 96,
          height: 96,
          borderRadius: 26,
          border: `1px solid ${LIGHT_BORDER}`,
          background: "#fff",
          display: "grid",
          placeItems: "center",
          cursor: result?.userAudioUrl ? "pointer" : "not-allowed",
          opacity: result?.userAudioUrl ? 1 : 0.6,
        }}
      >
{isUserPlaying ? <Pause className="h-12 w-12" /> : <Play className="h-12 w-12" />}
      </button>
    </div>
  </div>

  {/* Correct */}
  <div style={{ display: "grid", gap: 10 }}>
    <div style={{ fontSize: 26, fontWeight: 950, color: "#111827", textAlign: "center" }}>Correct pronunciation</div>
    <div style={{ display: "flex", justifyContent: "center" }}>
      <button
        type="button"
        onClick={toggleCorrectTts}
        disabled={!String(target).trim()}
        title="Play"
        style={{
          width: 96,
          height: 96,
          borderRadius: 26,
          border: `1px solid ${LIGHT_BORDER}`,
          background: "#fff",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          opacity: String(target).trim() ? 1 : 0.6,
        }}
      >
{isCorrectPlaying ? <Pause className="h-12 w-12" /> : <Play className="h-12 w-12" />}
      </button>
    </div>
  </div>
  {/* divider under Correct */}
<div style={{ height: 1, background: LIGHT_BORDER, width: "100%", marginTop: 30, marginBottom: 30
 }} />

{/* Try again + Next */}
<div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
  <button
    type="button"
    onClick={onTryAgain}
    disabled={isAnalyzing || isRecording || !String(target).trim()}
    style={{
      height: 46,
      padding: "0 18px",
      borderRadius: 16,
      border: "none",
      background: "#FF9800", // accent/orange
      color: "white",
      fontWeight: 950,
      cursor: "pointer",
      opacity: isAnalyzing || isRecording || !String(target).trim() ? 0.6 : 1,
      minWidth: 140,
    }}
  >
    Try again
  </button>

  <button
    type="button"
    onClick={onNext}
    disabled={isAnalyzing || isRecording}
    style={{
      height: 46,
      padding: "0 18px",
      borderRadius: 16,
      border: "none",
      background: BTN_BLUE, // blue
      color: "white",
      fontWeight: 950,
      cursor: "pointer",
      opacity: isAnalyzing || isRecording ? 0.6 : 1,
      minWidth: 140,
    }}
  >
    Next
  </button>
</div>

</div>


                </div>
              </div>
            </div>
          ) : null}
        </LayoutGroup>

        <audio ref={ttsAudioRef} playsInline preload="auto" />
      </div>
    </div>
  );
}