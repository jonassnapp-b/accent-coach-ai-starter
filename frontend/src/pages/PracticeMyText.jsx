// src/pages/PracticeMyText.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ChevronDown, Volume2, Play, X, RotateCcw } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import * as sfx from "../lib/sfx.js";

const IS_PROD = !!import.meta?.env?.PROD;
const RESULT_KEY = "ac_practice_my_text_result_v1";

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
        ph.accuracyScore ??
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

function scoreColor(score) {
  if (score == null) return "rgba(17,24,39,0.55)";
  if (score >= 85) return "#16a34a";
  if (score >= 70) return "#f59e0b";
  return "#ef4444";
}

function isGreen(score) {
  return score != null && score >= 85;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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
  if (s >= 95) return "Perfect.";
  if (s >= 90) return "Excellent.";
  if (s >= 75) return "Good job.";
  if (s >= 60) return "Needs a bit more work.";
  return "Needs work.";
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
  const slides = [];

  const words = Array.isArray(wordsArr) ? wordsArr : [];
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

      slides.push({
        type: "phoneme",
        key: `${code}_${i}_${wordText || "w"}`,
        code,
        letters,
        score,
        mediaKind: media.kind,
mediaSrc: media.src,    
  });
    }
  }

  return slides;
}

const PHONEME_SHORT_TIPS = {
  // examples (add more as you want)
  OW: "Round your lips. Glide from open to rounded as the sound finishes.",
  IY: "Spread your lips slightly. Keep your tongue high and forward.",
  K: "Back of the tongue touches the soft palate. Release with a clean burst.",
};
function getShortTipForPhoneme(code) {
  const c = String(code || "").toUpperCase();
  return PHONEME_SHORT_TIPS[c] || "Focus on mouth shape and airflow for this sound.";
}

export default function PracticeMyText() {
  const nav = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();

  const MAX_LEN = 220;

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

  const [accentUi, setAccentUi] = useState(settings.accentDefault || "en_us");
  useEffect(() => setAccentUi(settings.accentDefault || "en_us"), [settings.accentDefault]);

  const [refText, setRefText] = useState("");
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
  // Load analysis result from Practice.jsx (via navigate state or sessionStorage)
useEffect(() => {
  const fromState = location?.state?.result || null;

  if (fromState) {
    setResult(fromState);
    try { sessionStorage.setItem(RESULT_KEY, JSON.stringify(fromState)); } catch {}
    return;
  }

  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (raw) setResult(JSON.parse(raw));
  } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [location.key]);

// ---------------- Slide flow state ----------------
const [slideIdx, setSlideIdx] = useState(0);

// Slide 1 animation phases
// 0 = show word fade in, 1 = word moved up + start counting, 2 = show message
const [introPhase, setIntroPhase] = useState(0);
const [introPct, setIntroPct] = useState(0);

const [loopOn, setLoopOn] = useState(false);
const [playbackRate, setPlaybackRate] = useState(1.0);
const [deepDiveOpen, setDeepDiveOpen] = useState(false);
const [deepDivePhoneme, setDeepDivePhoneme] = useState(null); // { code, letters }


const userAudioRef = useRef(null);
const loopTimerRef = useRef(null);

const overallScore = useMemo(() => {
  const v = result?.overall ?? result?.pronunciation ?? result?.overallAccuracy ?? null;
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}, [result]);

const words = useMemo(() => normalizeWordsFromResult(result, result?.refText), [result]);

const weakPhonemeSlides = useMemo(() => buildWeakPhonemeSlidesFromWords(words), [words]);

const totalSlides = useMemo(() => {
  // 1 intro + phonemeSlides + 1 playback + 1 actions
  return 1 + weakPhonemeSlides.length + 1 + 1;
}, [weakPhonemeSlides.length]);

function clampSlide(i) {
  return Math.max(0, Math.min(i, totalSlides - 1));
}

function goPrev() {
  setSlideIdx((i) => clampSlide(i - 1));
}
function goNext() {
  setSlideIdx((i) => clampSlide(i + 1));
}
const isPhonemeOverlay = slideIdx >= 1 && slideIdx <= weakPhonemeSlides.length;
const activePhonemeSlide = isPhonemeOverlay ? weakPhonemeSlides[slideIdx - 1] : null;

// Reset slide flow when new result comes in
useEffect(() => {
  if (!result) return;
  setSlideIdx(0);

  setIntroPhase(0);
  setIntroPct(0);

  // phase timings (feel free to tweak)
const t1 = setTimeout(() => setIntroPhase(1), 900);
const t2 = setTimeout(() => setIntroPhase(2), 2400);


  // count-up starts when phase becomes 1
  return () => {
    clearTimeout(t1);
    clearTimeout(t2);
  };
}, [result]);

// Count-up when introPhase hits 1
useEffect(() => {
  if (!result) return;
  if (slideIdx !== 0) return;
  if (introPhase < 1) return;

  const target = Math.max(0, Math.min(100, Number(overallScore) || 0));
  let raf = 0;
  const start = performance.now();
  const dur = 1600; // ms

  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const val = Math.round(target * p);
    setIntroPct(val);
    if (p < 1) raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [result, introPhase, slideIdx, overallScore]);

function stopLoopTimer() {
  if (loopTimerRef.current) {
    clearTimeout(loopTimerRef.current);
    loopTimerRef.current = null;
  }
}

function stopAllAudio() {
  stopLoopTimer();
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

function playCorrectTts() {
  // “Play Correct” via TTS (fallback) — hvis du senere får en rigtig ref-audio-URL, kan du bruge den her i stedet.
  stopAllAudio();
  const text = String(result?.refText || "").trim();
  if (!text) return;

  try {
    if (!window?.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = playbackRate; // 1.0 / 0.85 / 0.75
    window.speechSynthesis.speak(u);

    if (loopOn) {
      u.onend = () => {
        loopTimerRef.current = setTimeout(() => playCorrectTts(), 220);
      };
    }
  } catch {}
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
hasVideo: media?.kind === "video" && !!media?.src,
        isWeak: s == null || !isGreen(s),
      });
    }

    return out;
  }, [currentWordObj]);

  const weakItems = useMemo(
    () => phonemeLineItems.filter((x) => x.hasVideo && x.isWeak),
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
      const text = sanitizeTextForSubmit(refText);
      const base = getApiBase();

      const fd = new FormData();
      fd.append("audio", audioBlob, "clip.webm");
      fd.append("refText", text);
      fd.append("accent", accentUi === "en_br" ? "en_br" : "en_us");

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
      onClick={() => nav(-1)}
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
        fontWeight: 950,
        letterSpacing: -0.4,
        lineHeight: 1.1,
        textAlign: "center",
        flex: "1 1 auto",
      }}
    >
      Practice My Text
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

{!!result && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      height: "100dvh",
      background: "#0B1220",
      color: "white",
      zIndex: 9999,
      paddingTop: `calc(${SAFE_TOP} + 14px)`,
      paddingLeft: 16,
      paddingRight: 16,
      paddingBottom: `calc(14px + ${SAFE_BOTTOM})`,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}
  >
    {/* Close: go back to Practice page (Playback slide) */}
    <button
      type="button"
onClick={() => {
  stopAllAudio();
nav("/practice");
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
      }}
    >
      <X className="h-5 w-5" />
    </button>

    {/* Centered width like other pages */}
    <div
      style={{
        width: "100%",
    maxWidth: 960,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: "1 1 auto",
      }}
    >
{/* CONTENT */}
<div
  style={{
    flex: "1 1 auto",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: slideIdx === 0 ? "center" : "flex-start",
    paddingTop: slideIdx === 0 ? 0 : 72, // mere space over overskriften på Playback/andre slides
    paddingBottom: 12,
  }}
>
  {slideIdx === 0 ? (
    // ----- Intro (CENTERED vertically) -----
    <>
      <div style={{ height: 170, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: introPhase >= 1 ? 10 : 34,
            opacity: 1,
            transform: `translateY(${introPhase >= 1 ? 0 : 10}px)`,
            transition: "all 900ms ease",
            textAlign: "center",
            fontWeight: 950,
            fontSize: 44,
            letterSpacing: -0.4,
            color: scoreColor(overallScore),
            textShadow: "0 12px 40px rgba(0,0,0,0.35)",
          }}
        >
          {String(result?.refText || "").trim() || "—"}
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 74,
            opacity: introPhase >= 1 ? 1 : 0,
            transform: `translateY(${introPhase >= 1 ? 0 : 10}px)`,
            transition: "all 800ms ease",
            textAlign: "center",
            fontWeight: 950,
            fontSize: 56,
            letterSpacing: -0.8,
            color: scoreColor(overallScore),
            textShadow: "0 14px 46px rgba(0,0,0,0.38)",
          }}
        >
          {introPct}%
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          textAlign: "center",
          fontWeight: 900,
          color: "rgba(255,255,255,0.72)",
          opacity: introPhase >= 2 ? 1 : 0,
          transform: `translateY(${introPhase >= 2 ? 0 : 8}px)`,
          transition: "all 650ms ease",
        }}
      >
        {pickShortLineFromScore(overallScore)}
      </div>
    </>
  ) : slideIdx >= 1 && slideIdx <= weakPhonemeSlides.length ? (
    // ----- Phoneme slides -----
    (() => {
      const s = weakPhonemeSlides[slideIdx - 1];
      if (!s) return null;

      return (
        <>
          <div style={{ paddingRight: 60 }}>
            <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: -0.5, lineHeight: 1.05 }}>
              {s.code} Sound
            </div>

            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", fontWeight: 650, lineHeight: 1.35 }}>
              {getShortTipForPhoneme(s.code)}
            </div>
          </div>

          <div
            style={{
              marginTop: 28,
              maxWidth: 920,
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
              <video
                key={s.mediaSrc}
                src={s.mediaSrc}
                playsInline
                muted
                autoPlay
                loop
                controls
                style={{ width: "100%", display: "block" }}
              />
            )}
          </div>

          <div style={{ marginTop: "auto" }}>
            <button
              type="button"
              onClick={() => {
                setDeepDivePhoneme({ code: s.code, letters: s.letters });
                setDeepDiveOpen(true);
              }}
              style={{
                width: "100%",
                height: 56,
                borderRadius: 20,
                border: "none",
                background: "rgba(255,255,255,0.14)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              Watch Deep Dive <span style={{ fontSize: 20, lineHeight: 0 }}>→</span>
            </button>
          </div>
        </>
      );
    })()
  ) : slideIdx === 1 + weakPhonemeSlides.length ? (
    // ----- Playback slide -----
    <>
      <div style={{ paddingRight: 60 }}>
        <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: -0.5, lineHeight: 1.05 }}>Playback</div>
        <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", fontWeight: 650, lineHeight: 1.35 }}>
          Listen to your attempt vs a “correct” reference.
        </div>
      </div>

      <div
        style={{
          marginTop: 22, // lidt mere luft under overskriften
          borderRadius: 22,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          padding: 14,
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={playYou}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 16,
              border: "none",
              background: "rgba(255,255,255,0.14)",
              color: "white",
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
              background: "rgba(255,255,255,0.10)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Play Correct
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
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
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
                  color: "white",
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
              border: "1px solid rgba(255,255,255,0.10)",
              background: loopOn ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
              color: "white",
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
      <div style={{ paddingRight: 60 }}>
        <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: -0.5, lineHeight: 1.05 }}>Next</div>
        <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", fontWeight: 650, lineHeight: 1.35 }}>
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
          onClick={async () => {
            stopAllAudio();
            setResult(null);
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
            border: "none",
            background: "rgba(255,255,255,0.14)",
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
          onClick={() => {
            stopAllAudio();
            nav("/practice");
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
          Back to Record
        </button>
      </div>

      <div style={{ marginTop: "auto" }} />
    </>
  )}
</div>



      {/* Chevrons (bottom) — IMPORTANT: allow going to Playback + Next */}
      <div
       style={{
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingLeft: 12,
  paddingRight: 12,
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
         width: 64,
height: 64,
borderRadius: 24,

            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.08)",
            display: "grid",
            placeItems: "center",
            cursor: slideIdx <= 0 ? "not-allowed" : "pointer",
            opacity: slideIdx <= 0 ? 0.45 : 1,
          }}
        >
<ChevronLeft className="h-8 w-8" />
        </button>

     <div
  style={{
    fontWeight: 950,
    fontSize: 22,
    letterSpacing: -0.2,
    color: "rgba(255,255,255,0.78)",
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
<ChevronRight className="h-7 w-7" />
        </button>
      </div>
    </div>
  </div>
)}

   

{/* Slides */}
<div style={{ marginTop: 14 }}>
  {!result ? (
    <div
      style={{
        paddingTop: 28,
        paddingBottom: 12,
        color: PAGE_MUTED,
        fontWeight: 900,
        textAlign: "center",
      }}
    >
      No result yet.
    </div>

  ) : (
    <div style={{ position: "relative" }}>
     

      {/* Slide content */}
      {slideIdx === 0 ? (
        // ---------------- Slide 1: word/sentence -> % count-up -> line ----------------
               <div
          style={{
            paddingTop: 18,
            paddingBottom: 10,
          }}
        >

          <div style={{ height: 120, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: introPhase >= 1 ? 8 : 28,
                opacity: introPhase >= 0 ? 1 : 0,
                transform: `translateY(${introPhase >= 1 ? 0 : 10}px)`,
                transition: "all 900ms ease",
                textAlign: "center",
                fontWeight: 950,
                fontSize: 44,
                letterSpacing: -0.4,
                color: scoreColor(overallScore),
              }}
            >
              {String(result?.refText || "").trim() || "—"}
            </div>

            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 56,
                opacity: introPhase >= 1 ? 1 : 0,
                transform: `translateY(${introPhase >= 1 ? 0 : 10}px)`,
                transition: "all 800ms ease",
                textAlign: "center",
                fontWeight: 950,
                fontSize: 44,
                letterSpacing: -0.6,
                color: scoreColor(overallScore),
              }}
            >
              {introPct}%
            </div>
          </div>

          <div
            style={{
              marginTop: 6,
              textAlign: "center",
              fontWeight: 900,
              color: PAGE_MUTED,
              opacity: introPhase >= 2 ? 1 : 0,
              transform: `translateY(${introPhase >= 2 ? 0 : 8}px)`,
              transition: "all 650ms ease",
            }}
          >
            {pickShortLineFromScore(overallScore)}
          </div>
        </div>

      ) : slideIdx === 1 + weakPhonemeSlides.length ? (
        // ---------------- Playback slide ----------------
              <div
          style={{
            paddingTop: 10,
            paddingBottom: 10,
          }}
        >

          <div style={{ fontWeight: 950, fontSize: 18, marginBottom: 12 }}>Playback</div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={playYou}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 16,
                  border: "none",
                  background: "rgba(33,150,243,0.12)",
                  fontWeight: 950,
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
                  height: 46,
                  borderRadius: 16,
                  border: "none",
                  background: "rgba(17,24,39,0.06)",
                  fontWeight: 950,
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
                      height: 42,
                      borderRadius: 14,
                      border: "none",
                      background: active ? "rgba(33,150,243,0.14)" : "rgba(17,24,39,0.06)",
                      fontWeight: 950,
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
                  width: 92,
                  height: 42,
                  borderRadius: 14,
                  border: "none",
                  background: loopOn ? "rgba(33,150,243,0.14)" : "rgba(17,24,39,0.06)",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                Loop
              </button>
            </div>
          </div>
        </div>
      ) : (
        // ---------------- Actions slide ----------------
                <div
          style={{
            paddingTop: 10,
            paddingBottom: 10,
          }}
        >

          <div style={{ fontWeight: 950, fontSize: 18, marginBottom: 12 }}>Next</div>

          <div style={{ display: "grid", gap: 10 }}>
            <button
              type="button"
              onClick={async () => {
                stopAllAudio();
                setResult(null);
                setErr("");
                setSlideIdx(0);
                setIntroPhase(0);
                setIntroPct(0);

                // optag igen uden navigation
                try {
                  await startPronunciationRecord();
                } catch {}
              }}
              style={{
                height: 48,
                borderRadius: 16,
                border: "none",
                background: "rgba(33,150,243,0.12)",
                fontWeight: 950,
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
              onClick={() => {
                stopAllAudio();
                nav(-1);
              }}
              style={{
                height: 48,
                borderRadius: 16,
                border: "none",
                background: "rgba(17,24,39,0.06)",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}
{!isPhonemeOverlay && (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
    <button
      type="button"
      onClick={() => {
        stopAllAudio();
        goPrev();
      }}
      disabled={slideIdx <= 0}
      style={{
        width: 44,
        height: 44,
        borderRadius: 16,
        border: `1px solid ${PAGE_BORDER}`,
        background: slideIdx <= 0 ? "rgba(255,255,255,0.65)" : PAGE_SURFACE,
        boxShadow: PAGE_SHADOW,
        display: "grid",
        placeItems: "center",
        cursor: slideIdx <= 0 ? "not-allowed" : "pointer",
        opacity: slideIdx <= 0 ? 0.5 : 1,
      }}
      aria-label="Previous"
    >
      <ChevronLeft className="h-6 w-6" />
    </button>

    <div style={{ fontWeight: 900, color: PAGE_MUTED }}>
      {slideIdx + 1} / {totalSlides}
    </div>

    <button
      type="button"
      onClick={() => {
        stopAllAudio();
        goNext();
      }}
      disabled={slideIdx >= totalSlides - 1}
      style={{
        width: 44,
        height: 44,
        borderRadius: 16,
        border: `1px solid ${PAGE_BORDER}`,
        background: slideIdx >= totalSlides - 1 ? "rgba(255,255,255,0.65)" : PAGE_SURFACE,
        boxShadow: PAGE_SHADOW,
        display: "grid",
        placeItems: "center",
        cursor: slideIdx >= totalSlides - 1 ? "not-allowed" : "pointer",
        opacity: slideIdx >= totalSlides - 1 ? 0.5 : 1,
      }}
      aria-label="Next"
    >
      <ChevronRight className="h-6 w-6" />
    </button>
  </div>
)}


    </div>
  )}
</div>




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
      paddingBottom: `calc(14px + ${SAFE_BOTTOM})`,
      overflow: "hidden",
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
      }}
    >
      <X className="h-5 w-5" />
    </button>

    <div style={{ paddingRight: 60 }}>
  <div style={{ fontSize: 30, fontWeight: 950, letterSpacing: -0.4 }}>{title}</div>

  <div style={{ marginTop: 6, color: "rgba(255,255,255,0.72)", fontWeight: 650 }}>
    {s.code} • Score {s.score == null ? "—" : Math.round(s.score)}%
  </div>

  <div style={{ marginTop: 10, color: "rgba(255,255,255,0.78)", fontSize: 16, lineHeight: 1.35 }}>
    {getShortTipForPhoneme(s.code)}
  </div>
</div>


    <div
      style={{
        marginTop: 14,
        borderRadius: 22,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        padding: 14,
        color: "rgba(255,255,255,0.78)",
        lineHeight: 1.35,
        flex: "1 1 auto",
        minHeight: 0,
        overflowY: "auto",
      }}
    >
      Deep dive content coming soon.
    </div>
  </div>
)}

    </div>
  );
}
