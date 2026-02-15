// src/pages/Coach.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Mic, StopCircle, X } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useSettings } from "../lib/settings-store.jsx";
import { ingestLocalPhonemeScores } from "../lib/localPhonemeStats.js";
import wordsImg from "../assets/words.png";
import difficultyImg from "../assets/difficulty.png";
import accentImg from "../assets/accent.png";


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
  easy: ["water", "coffee", "music", "people", "world", "future", "camera", "really", "better", "today", "little", "maybe"],
  medium: ["comfortable", "sentence", "accent", "problem", "thirty", "through", "thought", "focus", "balance", "practice"],
  hard: ["particularly", "entrepreneurship", "authenticity", "responsibility", "vulnerability", "pronunciation", "indistinguishable"],
};

const SENTENCES = {
  easy: ["I like coffee.", "The water is cold.", "I live in Denmark.", "This is my phone.", "I want to speak clearly."],
  medium: [
    "I want to sound more natural when I speak.",
    "Please try to pronounce this clearly and slowly.",
    "I recorded my voice and got feedback.",
    "I will practice a little every day.",
  ],
  hard: [
    "I would rather practice consistently than rush and burn out.",
    "Clear pronunciation comes from rhythm, stress, and good vowels.",
    "I want my speech to be clear even when I speak quickly.",
  ],
};

function pickRandom(arr) {
  if (!arr?.length) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildTargets({ mode, difficulty, total = 10 }) {
  const pool = mode === "sentences" ? (SENTENCES[difficulty] || []) : (WORDS[difficulty] || []);

  // Unique only (no duplicates within a session)
  const uniq = Array.from(new Set(pool)).filter(Boolean);

  // If pool is smaller than requested total, session becomes shorter (still no duplicates)
  const n = Math.min(total, uniq.length);

  // Fisher–Yates shuffle, then take first n
  const a = uniq.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a.slice(0, n);
}


function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getOverallFromResult(json) {
  const raw =
    json?.overall ??
    json?.overallAccuracy ??
    json?.pronunciation ??
    json?.overall_score ??
    json?.overall_accuracy ??
    json?.pronunciation_score ??
    json?.pronunciation_accuracy ??
    json?.accuracyScore ??
    json?.accuracy_score;

  let n = Number(raw);
  if (!Number.isFinite(n)) n = 0;
  if (n > 0 && n <= 1) n = n * 100;
  return clamp(Math.round(n), 0, 100);
}

function labelForScore(n) {
  if (n >= 85) return "Great";
  if (n >= 70) return "OK";
  return "Needs work";
}

function cycleValue(options, current, dir) {
  const i = Math.max(0, options.indexOf(current));
  const next = (i + dir + options.length) % options.length;
  return options[next];
}

export default function Coach() {
  const { settings } = useSettings();

  /* ---------------- UI tokens ---------------- */
  const LIGHT_TEXT = "rgba(17,24,39,0.92)";
  const LIGHT_MUTED = "rgba(17,24,39,0.55)";
  const LIGHT_BORDER = "rgba(0,0,0,0.10)";
  const LIGHT_SURFACE = "#FFFFFF";
  const BTN_BLUE = "#2196F3";

  const SAFE_BOTTOM = "env(safe-area-inset-bottom, 0px)";
  const SAFE_TOP = "env(safe-area-inset-top, 0px)";
  const TABBAR_OFFSET = 64;

  /* ---------------- Setup selections ---------------- */
  const MODE_OPTIONS = ["words", "sentences"];
  const MODE_LABEL = { words: "Words", sentences: "Sentences" };

  const DIFF_OPTIONS = ["easy", "medium", "hard"];
  const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };

  const ACCENT_OPTIONS = ["en_us", "en_br"];
  const ACCENT_LABEL = { en_us: "American 🇺🇸", en_br: "British 🇬🇧" };

const [mode, setMode] = useState("words");
const [difficulty, setDifficulty] = useState("easy");
const [accentUi, setAccentUi] = useState(settings?.accentDefault || "en_us");
const [setupStep, setSetupStep] = useState(0); // 0=mode, 1=difficulty, 2=accent

// ---------- Challenge mode (optional) ----------
const [challengeOn, setChallengeOn] = useState(false);

// “Green” definition + feel-good fairness: must hit green once within the timer.
const CHALLENGE_GREEN = 85;

// Time limit per difficulty (tuned to be “TikTok-challenge-hard” but still winnable)
const CHALLENGE_SECONDS = {
  easy: 20,
  medium: 20,
  hard: 20,
};


function challengeSecondsFor(difficulty) {
  return CHALLENGE_SECONDS[difficulty] ?? 10;
}



const [wordDeadlineMs, setWordDeadlineMs] = useState(null); // absolute timestamp
const [timeLeftMs, setTimeLeftMs] = useState(0);




  useEffect(() => {
    setAccentUi(settings?.accentDefault || "en_us");
  }, [settings?.accentDefault]);


  /* ---------------- Daily Drill state machine ---------------- */


  const [phase, setPhase] = useState("setup"); // setup | prompt | recording | analyzing | result | summary
useEffect(() => {
  if (!challengeOn) return;
  if (!wordDeadlineMs) return;
  if (phase === "setup" || phase === "summary") return;

  const id = setInterval(() => {
    const left = Math.max(0, wordDeadlineMs - Date.now());
    setTimeLeftMs(left);

   if (left <= 0) {
  clearInterval(id);
  goBackToSetup();
}

  }, 100);

  return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [challengeOn, wordDeadlineMs, phase]);
  const [lockedAccent, setLockedAccent] = useState("en_us");

  const [targets, setTargets] = useState([]); // 10 items
  const [idx, setIdx] = useState(0);
  const [attempts, setAttempts] = useState([]); // { i, text, overall, label, createdAt }
  const summary = useMemo(() => {
  if (!attempts.length) return { avg: 0, great: 0, ok: 0, needs: 0 };
  const sum = attempts.reduce((a, x) => a + (Number.isFinite(x.overall) ? x.overall : 0), 0);
  const avg = Math.round(sum / attempts.length);
  const great = attempts.filter((x) => x.label === "Great").length;
  const ok = attempts.filter((x) => x.label === "OK").length;
  const needs = attempts.filter((x) => x.label === "Needs work").length;
  return { avg, great, ok, needs };
}, [attempts]);

const [summaryCount, setSummaryCount] = useState(0);

  const currentText = targets[idx] || "";

  /* ---------------- Recording plumbing ---------------- */
  const micStreamRef = useRef(null);
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const userUrlRef = useRef(null);

  function cleanupUserUrl() {
    try {
      if (userUrlRef.current) URL.revokeObjectURL(userUrlRef.current);
    } catch {}
    userUrlRef.current = null;
  }

  function disposeRecorder() {
    try {
      micStreamRef.current?.getTracks?.()?.forEach((t) => t.stop());
    } catch {}
    micStreamRef.current = null;
    mediaRecRef.current = null;
  }

  function resetChallengeWordTimer() {
  setWordDeadlineMs(null);
  setTimeLeftMs(0);
}
function goBackToSetup() {
  // stop recording if running
  try {
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
  } catch {}

  cleanupUserUrl();
  resetChallengeWordTimer();
  setTargets([]);
  setIdx(0);
  setAttempts([]);
  setSetupStep(0);
  setPhase("setup");
}

function resetRunToStart() {
  // stop any active recording cleanly
  try {
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
  } catch {}

  cleanupUserUrl();
  resetChallengeWordTimer();
  setIdx(0);
  setAttempts([]);
  setPhase("prompt");
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

function startRecording() {
  if (!currentText.trim()) return;
  if (!mediaRecRef.current) return;

  // Start challenge timer when the user first records for this word
  if (challengeOn && !wordDeadlineMs) {
    const secs = CHALLENGE_SECONDS[difficulty] ?? 10;
    const deadline = Date.now() + secs * 1000;
    setWordDeadlineMs(deadline);
    setTimeLeftMs(secs * 1000);
  }

  chunksRef.current = [];
  mediaRecRef.current.start();
  setPhase("recording");
}


  function stopRecording() {
    try {
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
    } catch {}
  }

  async function toggleRecord() {
    if (phase === "recording") stopRecording();
    else if (phase === "prompt") {
      await ensureMic();
      startRecording();
    }
  }

  function handleStop(rec) {
    const chunks = chunksRef.current.slice();
    chunksRef.current = [];

    cleanupUserUrl();

    const type = chunks[0]?.type || rec?.mimeType || "audio/webm";
    const blob = new Blob(chunks, { type });
    const localUrl = URL.createObjectURL(blob);
    userUrlRef.current = localUrl;

    setPhase("analyzing");
    sendToServer(blob, localUrl);
  }

  async function sendToServer(audioBlob, localUrl) {
    try {
      const base = getApiBase();

      const fd = new FormData();
      fd.append("audio", audioBlob, "clip.webm");
      fd.append("refText", currentText);
      fd.append("accent", lockedAccent === "en_br" ? "en_br" : "en_us");
      fd.append("slack", String(settings?.slack ?? 0));

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
        if (e?.name === "AbortError") throw new Error(`Analysis timed out after ${Math.round(timeoutMs / 1000)}s`);
        throw e;
      } finally {
        clearTimeout(t);
      }

      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json?.error || r.statusText || "Analyze failed");

      // Save phoneme attempts locally (so your WeaknessLab can use it)
      try {
        const accentKey = lockedAccent === "en_br" ? "en_br" : "en_us";
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
        if (phonemePairs.length) ingestLocalPhonemeScores(accentKey, phonemePairs);
      } catch {}

      const overall = getOverallFromResult(json);
      const label = labelForScore(overall);

      setAttempts((prev) => [
        ...prev,
        { i: idx, text: currentText, overall, label, createdAt: Date.now(), userAudioUrl: localUrl },
      ]);

      setPhase("result");
    } catch (e) {
      // If it fails, go back to prompt and let user retry same target
      setPhase("prompt");
    }
  }

// Auto-next after result
useEffect(() => {
  if (phase !== "result") return;

  const total = targets.length || 0;
  const last = attempts[attempts.length - 1] || null;

  const t = setTimeout(() => {
    // NORMAL MODE: keep your current behavior
    if (!challengeOn) {
      setIdx((i) => {
        const next = i + 1;

        if (total > 0 && next >= total) {
          setPhase("summary");
          return i;
        }

        setPhase("prompt");
        cleanupUserUrl();
        return next;
      });
      return;
    }

    // CHALLENGE MODE:
    // - must get green (>=85) before timer ends
    const passed = !!last && last.i === idx && Number(last.overall) >= CHALLENGE_GREEN;
    const timedOut = wordDeadlineMs ? Date.now() > wordDeadlineMs : false;

    if (timedOut) {
  goBackToSetup();
  return;
}


    if (!passed) {
      // retry same word (timer keeps running)
      cleanupUserUrl();
      setPhase("prompt");
      return;
    }

    // passed => advance and reset timer for the next word
    resetChallengeWordTimer();

    setIdx((i) => {
      const next = i + 1;

      if (total > 0 && next >= total) {
        setPhase("summary");
        return i;
      }

      setPhase("prompt");
      cleanupUserUrl();
      return next;
    });
  }, 900); // slightly snappier for “challenge feel”

  return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase, targets.length, attempts, challengeOn, idx, wordDeadlineMs]);


// Count-up when summary shows
useEffect(() => {
  if (phase !== "summary") return;

  const target = Math.max(0, Math.min(100, summary.avg || 0));
  setSummaryCount(0);

  const start = performance.now();
  const dur = 650;

  let raf = 0;
  const tick = (t) => {
    const p = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    setSummaryCount(Math.round(target * eased));
    if (p < 1) raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [phase, summary.avg]);

  function onStartDrill() {
    const acc = accentUi === "en_br" ? "en_br" : "en_us";
    setLockedAccent(acc);

    const t = buildTargets({ mode, difficulty, total: 10 });
    setTargets(t);
    setIdx(0);
    setAttempts([]);
    cleanupUserUrl();
    resetChallengeWordTimer();

    setPhase("prompt");
    if (challengeOn) {
  const ms = challengeSecondsFor(difficulty) * 1000;
  setWordDeadlineMs(Date.now() + ms);
  setTimeLeftMs(ms);
}

  }

  function onExit() {
    cleanupUserUrl();
    disposeRecorder();
    setTargets([]);
    setIdx(0);
    setAttempts([]);
    setSetupStep(0);
resetChallengeWordTimer();
setChallengeOn(false);

    setPhase("setup");
  }

  function onRepeatSameDrill() {
    cleanupUserUrl();
    setIdx(0);
    setAttempts([]);
    resetChallengeWordTimer();

    setPhase("prompt");
  }



  /* ---------------- UI helpers ---------------- */
  const pickerRow = {
    display: "grid",
    gridTemplateColumns: "56px 1fr 56px",
    alignItems: "center",
    gap: 12,
  };

  // iOS-ish controls: subtle border + tiny shadow + slight surface fill
  const pickerBtn = {
    width: 56,
    height: 56,
    borderRadius: 18,
    border: `1px solid rgba(0,0,0,0.08)`,
    background: "rgba(255,255,255,0.72)",
    boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 18px rgba(0,0,0,0.06)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  };

const pickerCenter = {
  textAlign: "center",
  fontWeight: 950,
  fontSize: 26,
  color: LIGHT_TEXT,
  lineHeight: 1.02,
  letterSpacing: -0.35,
};

  const setupCard = {
   background: "rgba(255,255,255,0.96)",
border: "1px solid rgba(17,24,39,0.08)",
    borderRadius: 28,
    padding: 18,
boxShadow: "0 22px 60px rgba(17,24,39,0.10), 0 1px 0 rgba(255,255,255,0.8) inset",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  };

const hairlineDivider = {
  height: 1,
  margin: "12px 10px",
  background:
    "linear-gradient(90deg, rgba(17,24,39,0.00), rgba(17,24,39,0.10), rgba(17,24,39,0.00))",
};


  // Real iOS primary button: taller, full-ish width, depth
  const primaryBtn = {
    height: 58,
    width: "min(520px, 100%)",
    borderRadius: 999,
    border: "none",
background: "linear-gradient(180deg, #2FA8FF 0%, #1E88E5 100%)",
    color: "white",
    fontWeight: 850,
    fontSize: 18,
    letterSpacing: -0.2,
    cursor: "pointer",
boxShadow:
  "0 22px 60px rgba(33,150,243,0.28), 0 1px 0 rgba(255,255,255,0.42) inset, 0 -1px 0 rgba(0,0,0,0.10) inset",
  };


  const ghostBtn = {
    height: 40,
    padding: "0 12px",
    borderRadius: 14,
    border: `1px solid ${LIGHT_BORDER}`,
    background: LIGHT_SURFACE,
    fontWeight: 900,
    color: LIGHT_TEXT,
    cursor: "pointer",
  };

  const chip = (bg) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${LIGHT_BORDER}`,
    background: bg,
    fontWeight: 900,
    fontSize: 12,
    color: LIGHT_TEXT,
  });

  const lastAttempt = attempts[attempts.length - 1] || null;
  const totalCount = targets?.length || 10;
  const stepNow = Math.min(idx + 1, totalCount);
  const progressPct = totalCount ? Math.round((stepNow / totalCount) * 100) : 0;
  const metaText = `Word ${stepNow} of ${totalCount} • ${MODE_LABEL[mode]} • ${DIFF_LABEL[difficulty]} • ${ACCENT_LABEL[lockedAccent]}`;

  const flowHeaderWrap = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  };

  const flowTitle = {
    fontSize: 22,
    fontWeight: 1000,
    letterSpacing: -0.6,
    color: LIGHT_TEXT,
    lineHeight: 1.05,
  };

  const flowMeta = {
    marginTop: 6,
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: -0.15,
    color: LIGHT_MUTED,
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  };

  const progressTrack = {
    height: 3,
    borderRadius: 999,
    background: "rgba(17,24,39,0.10)",
    overflow: "hidden",
  };

  const progressFill = {
    height: "100%",
    width: `${progressPct}%`,
    borderRadius: 999,
    background: "rgba(33,150,243,0.80)",
  };

  const closeBtn = {
    width: 38,
    height: 38,
    borderRadius: 999,
    border: "1px solid rgba(17,24,39,0.10)",
    background: "rgba(255,255,255,0.70)",
    boxShadow: "0 10px 22px rgba(17,24,39,0.10), 0 1px 0 rgba(255,255,255,0.9) inset",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  };

  const flowCard = {
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(17,24,39,0.08)",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 22px 60px rgba(17,24,39,0.10), 0 1px 0 rgba(255,255,255,0.8) inset",
  };

  const heroWord = {
    fontSize: 32,
    fontWeight: 1000,
    letterSpacing: -0.8,
    color: LIGHT_TEXT,
    textAlign: "center",
    lineHeight: 1.05,
  };

  const hintText = {
    marginTop: 10,
    fontSize: 13,
    fontWeight: 850,
    letterSpacing: -0.15,
    color: LIGHT_MUTED,
    textAlign: "center",
  };

  const micBtn = (isRecording, isDisabled) => ({
    width: 80,
    height: 80,
    borderRadius: 26,
    border: "1px solid rgba(17,24,39,0.08)",
    background: isRecording
      ? "linear-gradient(180deg, rgba(17,24,39,0.92) 0%, rgba(17,24,39,0.82) 100%)"
      : "linear-gradient(180deg, #2FA8FF 0%, #1E88E5 100%)",
    boxShadow: isRecording
      ? "0 18px 50px rgba(17,24,39,0.18), 0 1px 0 rgba(255,255,255,0.20) inset"
      : "0 22px 60px rgba(33,150,243,0.28), 0 1px 0 rgba(255,255,255,0.42) inset, 0 -1px 0 rgba(0,0,0,0.10) inset",
    display: "grid",
    placeItems: "center",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.6 : 1,
    position: "relative",
  });

  const micGlow = {
    position: "absolute",
    inset: -18,
    borderRadius: 34,
    background: "radial-gradient(circle, rgba(33,150,243,0.22) 0%, rgba(33,150,243,0.00) 70%)",
    pointerEvents: "none",
  };
const summaryCard = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(17,24,39,0.08)",
  borderRadius: 24,
  padding: 22,
  boxShadow: "0 22px 60px rgba(17,24,39,0.10), 0 1px 0 rgba(255,255,255,0.8) inset",
  display: "grid",
  gap: 16,
};

const summaryTitle = {
  fontSize: 18,
  fontWeight: 1000,
  letterSpacing: -0.45,
  color: LIGHT_TEXT,
};

const summaryHeroWrap = {
  display: "grid",
  placeItems: "center",
  paddingTop: 6,
  paddingBottom: 2,
};

const ringWrap = { position: "relative", width: 120, height: 120, display: "grid", placeItems: "center" };

const ringInner = {
  position: "absolute",
  inset: 8,
  borderRadius: 999,
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(17,24,39,0.08)",
};

const ringLabel = {
  marginTop: 10,
  fontSize: 12,
  fontWeight: 850,
  letterSpacing: -0.1,
  color: LIGHT_MUTED,
};

const badgesRow = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 10,
  marginTop: 6,
};

const statBadge = (tintBg) => ({
  borderRadius: 18,
  border: "1px solid rgba(17,24,39,0.08)",
  background: tintBg,
  padding: "10px 12px",
  display: "grid",
  gap: 2,
});

const badgeLabel = { fontSize: 12, fontWeight: 900, color: LIGHT_MUTED, letterSpacing: -0.1 };
const badgeValue = { fontSize: 18, fontWeight: 1100, color: LIGHT_TEXT, letterSpacing: -0.4 };

const summaryCtas = {
  display: "grid",
  gap: 10,
  marginTop: 8,
};
  const WHEEL_ITEM_H = 44;

  function WheelPicker({ options, value, onChange }) {
    const ref = useRef(null);
    const snapT = useRef(0);

    const idx = Math.max(
      0,
      options.findIndex((o) => o.key === value)
    );

    // Scroll to selected on mount / value change
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      el.scrollTop = idx * WHEEL_ITEM_H;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);



    function commitNearest() {
      const el = ref.current;
      if (!el) return;
      const i = Math.round(el.scrollTop / WHEEL_ITEM_H);
      const clamped = Math.max(0, Math.min(options.length - 1, i));
      const next = options[clamped]?.key;
      if (next && next !== value) onChange(next);
      el.scrollTo({ top: clamped * WHEEL_ITEM_H, behavior: "smooth" });
    }

    function onScroll() {
      clearTimeout(snapT.current);
      snapT.current = window.setTimeout(() => {
        commitNearest();
      }, 90);
    }

   return (
  <div
    style={{
      position: "relative",
      background: "transparent",
      height: WHEEL_ITEM_H * 3,
      overflow: "hidden",
    }}
  >

        {/* center highlight */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: WHEEL_ITEM_H,
            height: WHEEL_ITEM_H,
            background: "rgba(33,150,243,0.06)",
            pointerEvents: "none",
          }}
        />

        <div
          ref={ref}
          onScroll={onScroll}
          style={{
            height: "100%",
            overflowY: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            scrollSnapType: "y mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* padding so first/last can align in center */}
          <div style={{ height: WHEEL_ITEM_H }} />
          {options.map((o) => {
            const active = o.key === value;
            return (
              <div
                key={o.key}
                onClick={() => onChange(o.key)}
                style={{
                  height: WHEEL_ITEM_H,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 20,
                  fontWeight: 600, // NOT bold question; picker can be semi-bold like iOS
                  letterSpacing: -0.2,
                  color: active ? "rgba(17,24,39,0.92)" : "rgba(17,24,39,0.55)",
                  scrollSnapAlign: "center",
                  userSelect: "none",
                  cursor: "pointer",
                }}
              >
                {o.label}
              </div>
            );
          })}
          <div style={{ height: WHEEL_ITEM_H }} />
        </div>

        {/* hide scrollbar in webkit */}
        <style>{`
          [data-wheel]::-webkit-scrollbar { display: none; }
        `}</style>
      </div>
    );
  }

  return (
    <div
  className="page"
  style={{
    position: "relative",
    minHeight: "100vh",
background: "linear-gradient(180deg, rgba(33,150,243,0.08) 0%, #FFFFFF 58%)",

    paddingBottom: 0,
    paddingTop: "var(--safe-top)",
    display: "flex",
    flexDirection: "column",
    color: LIGHT_TEXT,
  }}
>

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
     



     <div
  style={{
    flex: 1,
    width: "100%",
    maxWidth: 720,
    margin: "0 auto",

    background: "transparent",
    borderRadius: 0,
    boxShadow: "none",
    padding: "0 16px",
    paddingTop: 12,
    paddingBottom: `calc(${TABBAR_OFFSET}px + 16px + ${SAFE_BOTTOM})`,
  }}
>


          <div className="mx-auto w-full" style={{ maxWidth: 720 }}>
            <LayoutGroup>
              <AnimatePresence mode="wait">
                {phase === "setup" ? (
  <motion.div
    key="setup"
    initial={{ opacity: 0, y: 10, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -8, scale: 0.98 }}
    transition={{ duration: 0.18 }}
    style={{
      display: "grid",
      gap: 16,
      minHeight: `calc(100vh - var(--safe-top) - ${TABBAR_OFFSET}px - ${SAFE_BOTTOM} - 24px)`,
      alignContent: "center",
      paddingTop: 10,
      transform: "translateY(-14px)",
    }}
  >
    {(() => {
      const question =
        setupStep === 0
          ? "What do you want to practice?"
          : setupStep === 1
          ? "Choose a difficulty level"
          : "Which accent do you want?";

      const options =
        setupStep === 0
          ? [
              { key: "words", label: "Words" },
              { key: "sentences", label: "Sentences" },
            ]
          : setupStep === 1
          ? [
              { key: "easy", label: "Easy" },
              { key: "medium", label: "Medium" },
              { key: "hard", label: "Hard" },
            ]
          : [
              { key: "en_us", label: "American 🇺🇸" },
              { key: "en_br", label: "British 🇬🇧" },
            ];

      const value = setupStep === 0 ? mode : setupStep === 1 ? difficulty : accentUi;
      const setValue = (k) => {
        if (setupStep === 0) setMode(k);
        else if (setupStep === 1) setDifficulty(k);
        else setAccentUi(k);
      };

      return (
        <div
          style={{
            display: "grid",
            gridTemplateRows: "auto auto auto auto auto",
            gap: 14,
            minHeight: `calc(100vh - var(--safe-top) - ${TABBAR_OFFSET}px - ${SAFE_BOTTOM} - 24px)`,
            alignContent: "start",
            paddingTop: 10,
          }}
        >
          {/* Title */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 34, fontWeight: 1000, letterSpacing: -0.8, color: LIGHT_TEXT }}>
              Daily Drill
            </div>
            <div style={{ marginTop: 6, fontSize: 15, fontWeight: 600, color: LIGHT_MUTED, letterSpacing: -0.2 }}>
              Improve your pronunciation in minutes
            </div>
            <div style={{ marginTop: 14, display: "grid", placeItems: "center" }}>
  <div
    style={{
      display: "inline-flex",
      gap: 6,
      padding: 6,
      borderRadius: 999,
      border: "1px solid rgba(17,24,39,0.10)",
      background: "rgba(255,255,255,0.70)",
      boxShadow: "0 10px 22px rgba(17,24,39,0.08)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
    }}
  >
    <button
      type="button"
      onClick={() => {
  setChallengeOn(false);
  setSetupStep(0);
}}
      style={{
        height: 36,
        padding: "0 14px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        fontWeight: 950,
        letterSpacing: -0.15,
        background: !challengeOn ? "rgba(33,150,243,0.95)" : "transparent",
        color: !challengeOn ? "white" : "rgba(17,24,39,0.72)",
      }}
    >
      Normal
    </button>

    <button
      type="button"
      onClick={() => {
  setChallengeOn(true);
  setSetupStep(0);
}}
      style={{
        height: 36,
        padding: "0 14px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        fontWeight: 950,
        letterSpacing: -0.15,
        background: challengeOn ? "rgba(33,150,243,0.95)" : "transparent",
        color: challengeOn ? "white" : "rgba(17,24,39,0.72)",
      }}
    >
      Challenge
    </button>
  </div>

  {challengeOn ? (
    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: LIGHT_MUTED, letterSpacing: -0.1 }}>
      Beat each word in {challengeSecondsFor(difficulty)}s • Miss one → restart from word 1
    </div>
  ) : null}
</div>

          </div>

          {/* Progress bars */}
          <div style={{ padding: "0 22px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: i === setupStep ? "rgba(33,150,243,0.95)" : "rgba(33,150,243,0.22)",
                  }}
                />
              ))}
            </div>
          </div>

         <div
  style={{
    display: "grid",
    placeItems: "center",
    margin: "0 22px",
    paddingTop: 8,
    paddingBottom: 8,
  }}
>
  <img
    src={
      setupStep === 0
        ? wordsImg
        : setupStep === 1
        ? difficultyImg
        : accentImg
    }
    alt=""
style={{
  width: 140,
  height: 140,
  objectFit: "contain",
  pointerEvents: "none",
  userSelect: "none",
}}

  />
</div>


          {/* Question (NOT bold) */}
          <div
            style={{
              textAlign: "center",
              fontWeight: 500,
              fontSize: 22,
              letterSpacing: -0.45,
              color: LIGHT_TEXT,
              padding: "0 22px",
            }}
          >
            {question}
          </div>

          {/* Wheel picker */}
          <div style={{ marginTop: 2, padding: "0 22px" }}>
            <WheelPicker options={options} value={value} onChange={setValue} />
          </div>

          {/* Bottom buttons */}
          <div
  style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: "0 22px",
    marginTop: 10,
  }}
>


            {setupStep > 0 ? (
              <button
                type="button"
                onClick={() => setSetupStep((s) => Math.max(0, s - 1))}
               style={{
  height: 52,
  padding: "0 18px",
  borderRadius: 14,
  border: "1px solid rgba(17,24,39,0.14)",
  background: "rgba(255,255,255,0.45)",
  color: "rgba(17,24,39,0.72)",
  fontWeight: 850,
  cursor: "pointer",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  minWidth: 120,
}}

              >
                Back
              </button>
            ) : null}

            <motion.button
              type="button"
              onClick={() => {
                if (setupStep < 2) setSetupStep((s) => s + 1);
                else onStartDrill();
              }}
         style={{
  ...primaryBtn,
  height: 52,
  flex: 1,
  borderRadius: 14,
  maxWidth: 420,
}}


              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 700, damping: 40 }}
            >
              {setupStep < 2 ? "Next" : "Start"}
            </motion.button>
          </div>
        </div>
      );
    })()}
  </motion.div>
) : null}

{phase !== "setup" ? (
  <motion.div
    key="flow"
    initial={{ opacity: 0, y: 10, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -8, scale: 0.98 }}
    transition={{ duration: 0.18 }}
    style={{
      minHeight: `calc(100vh - var(--safe-top) - ${TABBAR_OFFSET}px - ${SAFE_BOTTOM})`,
      borderRadius: 28,
      padding: 18,
      background:
        "linear-gradient(180deg, rgba(33,150,243,0.98) 0%, rgba(33,150,243,0.92) 60%, rgba(33,150,243,0.86) 100%)",
      position: "relative",
      display: "grid",
      gridTemplateRows: "auto 1fr",
      gap: 14,
      boxShadow: "0 22px 60px rgba(17,24,39,0.18)",
    }}
  >
    {/* Header */}
    <div style={{ position: "relative", paddingTop: 6, paddingBottom: 6 }}>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 34,
            fontWeight: 1100,
            letterSpacing: -0.8,
            color: "rgba(255,255,255,0.98)",
            lineHeight: 1.05,
          }}
        >
          Daily Drill
        </div>
{challengeOn && (phase === "prompt" || phase === "recording" || phase === "analyzing") ? (
  <div style={{ marginTop: 8, display: "grid", placeItems: "center" }}>
    <div
      style={{
        fontSize: 56,
        fontWeight: 1100,
        letterSpacing: -1.2,
        color: "rgba(255,255,255,0.98)",
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        textShadow: "0 18px 40px rgba(0,0,0,0.18)",
      }}
    >
      {(Math.max(0, timeLeftMs || 0) / 1000).toFixed(1)}
    </div>
    <div style={{ marginTop: 2, fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.78)" }}>
      seconds left
    </div>
  </div>
) : null}

        <div style={{ marginTop: 10, display: "grid", placeItems: "center" }}>
    <div
  style={{
    marginTop: 10,
    textAlign: "center",
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: 850,
    letterSpacing: -0.15,
  }}
>
  {metaText}
{challengeOn ? (
  <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
    <div
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.22)",
        background: "rgba(255,255,255,0.14)",
        fontSize: 12,
        fontWeight: 950,
        letterSpacing: -0.1,
      }}
    >
      Challenge
    </div>

    {wordDeadlineMs ? (
      <div
       style={{
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(0,0,0,0.14)",
  fontSize: 14,
  fontWeight: 1000,
  letterSpacing: -0.1,
  fontVariantNumeric: "tabular-nums",
}}

      >
        ⏱ {Math.ceil((timeLeftMs || 0) / 1000)}s
      </div>
    ) : (
      <div
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.22)",
          background: "rgba(0,0,0,0.10)",
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: -0.1,
        }}
      >
        Start recording to begin timer
      </div>
    )}
  </div>
) : null}
</div>

        </div>
      </div>

      <motion.button
        type="button"
        onClick={onExit}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 700, damping: 40 }}
        disabled={phase === "analyzing"}
        aria-label="Close"
        title="Close"
        style={{
          position: "absolute",
          right: 8,
          top: 8,
          width: 38,
          height: 38,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.28)",
          background: "rgba(255,255,255,0.18)",
          color: "white",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 10px 22px rgba(17,24,39,0.16)",
        }}
      >
        <X className="h-5 w-5" />
      </motion.button>

      <div
        style={{
          marginTop: 14,
          height: 2,
          borderRadius: 999,
          background: "rgba(255,255,255,0.24)",
        }}
      />
    </div>

    {/* Content */}
    <div
      style={{
        display: "grid",
        alignContent: "start",
        justifyItems: "center",
        gap: 18,
        paddingTop: 10,
        paddingBottom: `calc(${TABBAR_OFFSET}px + 22px + ${SAFE_BOTTOM})`,
      }}
    >
      {(phase === "prompt" || phase === "recording" || phase === "analyzing") ? (
        <>
          {/* Card: ONLY text */}
          <div
            style={{
              width: "min(640px, 100%)",
              background: "rgba(255,255,255,0.98)",
              borderRadius: 28,
              padding: "28px 26px",
              border: "1px solid rgba(17,24,39,0.08)",
              boxShadow: "0 26px 70px rgba(17,24,39,0.18)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: mode === "sentences" ? 30 : 34,
                fontWeight: 1100,
                letterSpacing: -0.9,
                color: "rgba(17,24,39,0.92)",
                lineHeight: 1.08,
                wordBreak: "break-word",
              }}
            >
              {currentText || "—"}
            </div>
          </div>

          {/* Record button UNDER card */}
          <div style={{ width: "min(640px, 100%)", display: "grid", placeItems: "center", marginTop: 6 }}>
            <motion.button
              type="button"
              onClick={toggleRecord}
              disabled={phase === "analyzing" || !currentText}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 700, damping: 40 }}
              title={phase === "recording" ? "Stop" : "Record"}
              style={{
                width: 92,
                height: 92,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.28)",
                background: phase === "recording" ? "rgba(17,24,39,0.92)" : "rgba(255,255,255,0.92)",
                display: "grid",
                placeItems: "center",
                cursor: phase === "analyzing" || !currentText ? "not-allowed" : "pointer",
                opacity: phase === "analyzing" || !currentText ? 0.7 : 1,
                boxShadow:
                  phase === "recording"
                    ? "0 24px 70px rgba(17,24,39,0.26)"
                    : "0 24px 70px rgba(17,24,39,0.18), 0 0 0 14px rgba(255,255,255,0.10)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
              }}
            >
              {phase === "recording" ? (
                <StopCircle className="h-8 w-8" style={{ color: "white" }} />
              ) : (
                <Mic className="h-8 w-8" style={{ color: BTN_BLUE }} />
              )}
            </motion.button>
          </div>
        </>
      ) : null}

      {/* RESULT (keep your existing one if you want; this is identical to what you had) */}
      {phase === "result" && lastAttempt ? (
        <motion.div
          key={`result-${lastAttempt.createdAt}`}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 700, damping: 45 }}
          style={{
            width: "min(640px, 100%)",
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(17,24,39,0.08)",
            borderRadius: 24,
            padding: 22,
            display: "grid",
            gap: 12,
            placeItems: "center",
            textAlign: "center",
            boxShadow: "0 22px 60px rgba(17,24,39,0.18), 0 1px 0 rgba(255,255,255,0.8) inset",
          }}
        >
          <div style={{ position: "relative", width: 92, height: 92, display: "grid", placeItems: "center" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                background:
                  "conic-gradient(from 270deg, rgba(33,150,243,0.90) 0%, rgba(33,150,243,0.90) " +
                  `${Math.max(0, Math.min(100, lastAttempt.overall))}%` +
                  ", rgba(17,24,39,0.08) 0%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 6,
                borderRadius: 999,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(17,24,39,0.08)",
              }}
            />
            <div style={{ position: "relative", fontSize: 30, fontWeight: 1100, letterSpacing: -0.7, color: LIGHT_TEXT }}>
              {lastAttempt.overall}%
            </div>
          </div>

          <div
            style={{
              padding: "7px 12px",
              borderRadius: 999,
              border: "1px solid rgba(17,24,39,0.10)",
              background: "rgba(33,150,243,0.08)",
              fontSize: 13,
              fontWeight: 950,
              letterSpacing: -0.15,
              color: LIGHT_TEXT,
            }}
          >
            {lastAttempt.label}
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: LIGHT_MUTED, letterSpacing: -0.1 }}>Auto-next…</div>
        </motion.div>
      ) : null}

      {/* SUMMARY (you already have summaryCard etc.) */}
      {phase === "summary" ? (
        <motion.div
          key="summary"
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.985 }}
          transition={{ type: "spring", stiffness: 700, damping: 45 }}
          style={{ ...summaryCard, width: "min(640px, 100%)" }}
        >
          <div style={summaryTitle}>Session summary</div>

          <div style={summaryHeroWrap}>
            <div style={ringWrap}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 999,
                  background:
                    "conic-gradient(from 270deg, rgba(33,150,243,0.90) 0%, rgba(33,150,243,0.90) " +
                    `${Math.max(0, Math.min(100, summaryCount))}%` +
                    ", rgba(17,24,39,0.08) 0%)",
                }}
              />
              <div style={ringInner} />
              <div style={{ position: "relative", fontSize: 46, fontWeight: 1150, letterSpacing: -1.0, color: LIGHT_TEXT }}>
                {summaryCount}%
              </div>
            </div>
            <div style={ringLabel}>Session average</div>
          </div>

          <div style={badgesRow}>
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 700, damping: 45 }}
              style={statBadge("rgba(34,197,94,0.06)")}
            >
              <div style={badgeLabel}>Great</div>
              <div style={badgeValue}>{summary.great}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.10, type: "spring", stiffness: 700, damping: 45 }}
              style={statBadge("rgba(17,24,39,0.04)")}
            >
              <div style={badgeLabel}>OK</div>
              <div style={badgeValue}>{summary.ok}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 700, damping: 45 }}
              style={statBadge("rgba(239,68,68,0.06)")}
            >
              <div style={badgeLabel}>Needs work</div>
              <div style={badgeValue}>{summary.needs}</div>
            </motion.div>
          </div>

          <div style={summaryCtas}>
            <button type="button" onClick={onRepeatSameDrill} style={{ ...primaryBtn, justifySelf: "center" }}>
              Repeat
            </button>
            <div style={{ display: "grid", placeItems: "center" }}>
              <button type="button" onClick={onExit} style={{ ...ghostBtn, height: 44, width: "min(240px, 100%)" }}>
                New drill
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </div>
  </motion.div>
) : null}

              </AnimatePresence>
            </LayoutGroup>
          </div>
        </div>
      </div>
    </div>
  );
}
