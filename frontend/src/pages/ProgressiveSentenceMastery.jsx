// src/pages/ProgressiveSentenceMastery.jsx
import React, { useMemo, useEffect, useRef, useState } from "react";
import { useSettings } from "../lib/settings-store.jsx";
import {
  LEVELS,
  getLevelConfig,
  getNextSentence,
  advanceSentence,
  backSentence,
  resetLevel,
  getLevel,
  setLevel,
} from "../lib/sentenceBank.js";


/* ---------------- helpers ---------------- */

function isNative() {
  return !!(window?.Capacitor && window.Capacitor.isNativePlatform);
}

function getApiBase() {
  const ls = (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) || "";
  const env = (import.meta?.env && import.meta.env.VITE_API_BASE) || "";
  if (isNative()) {
    const base = (ls || env).replace(/\/+$/, "");
    if (!base) throw new Error("VITE_API_BASE (or localStorage.apiBase) is missing — required on iOS.");
    return base;
  }
  return (ls || env || window.location.origin).replace(/\/+$/, "");
}

function clamp01(v) {
  const n = Number(v);
  if (!isFinite(n)) return null;
  return n <= 1 ? Math.max(0, Math.min(1, n)) : Math.max(0, Math.min(1, n / 100));
}

function wordScore100LikePF(wordObj) {
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

    // SpeechSuper spans often in 10ms units (start/end)
    const span = ph.span || ph.time || null;
    const start10 = span?.start ?? span?.s ?? null;
    const end10 = span?.end ?? span?.e ?? null;

    const dur =
      typeof start10 === "number" && typeof end10 === "number" && end10 > start10
        ? (end10 - start10) * 0.01
        : 1; // fallback weight=1 if no span

    num += s01 * dur;
    den += dur;
  }

  if (!den) return null;
  return Math.round((num / den) * 100);
}


function isAllGreen(result, thresholdPct = 85) {
  if (!result) return false;

  const words = Array.isArray(result.words) ? result.words : [];
  if (!words.length) return false;

  let total = 0;
  let ok = 0;

  for (const w of words) {
    const phs = Array.isArray(w.phonemes) ? w.phonemes : [];
    for (const ph of phs) {
      const p01 = clamp01(
        ph.pronunciation ??
          ph.accuracy_score ??
          ph.pronunciation_score ??
          ph.score ??
          ph.accuracy ??
          ph.accuracyScore
      );
      if (p01 == null) continue;
      total++;
      if (p01 * 100 >= thresholdPct) ok++;
    }
  }

  if (!total) return false;

  // ✅ COACH LOGIC (EASIER):
  // - allow a few misses (makes long sentences fair)
  const allowedMisses = 3; // prøv 3 (nemmere), 2 (sværere), 5 (meget nemt)

  // - OR require only X% green phonemes
  const passRatio = 0.75; // 0.75 = realistisk, 0.80 = strammere

  const misses = total - ok;
  const ratio = ok / total;

  return misses <= allowedMisses || ratio >= passRatio;
}



function pickBestMime() {
  const prefs = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"];
  for (const t of prefs) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

function normalizeRefText(s) {
  return String(s || "")
    .replace(/[.?!,:;]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAudioMime(mime) {
  const m = String(mime || "").toLowerCase().trim();

  // Chrome kan fejle på "audio/mp3" – brug audio/mpeg
  if (m === "audio/mp3" || m.includes("mp3")) return "audio/mpeg";

  // fallback
  return mime || "audio/mpeg";
}

function base64ToBlobUrl(b64, mime) {
  const clean = String(b64 || "").includes(",") ? String(b64).split(",").pop() : String(b64 || "");
  if (!clean) throw new Error("Empty audioBase64");

  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const safeMime = normalizeAudioMime(mime || "audio/mpeg");
  const blob = new Blob([bytes], { type: safeMime });
  return URL.createObjectURL(blob);
}


/* ---------------- config ---------------- */

const CLEARS_PER_LEVEL_UP = 5;
const CLEARS_KEY = "ac_psm_clears_in_level_v1";


/* ---------------- component ---------------- */

export default function ProgressiveSentenceMastery() {
  const { settings } = useSettings();
  // Keep TTS <audio> volume in sync with global settings
  useEffect(() => {
    const a = ttsAudioRef.current;
    if (!a) return;

    const v = Number(settings?.volume);
    a.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6;
  }, [settings?.volume]);

  // persisted level
  const [levelId, setLevelIdState] = useState(() => {
    try {
      const id = getLevel();
      return LEVELS.some((l) => l.id === id) ? id : LEVELS[0].id;
    } catch {
      return LEVELS[0].id;
    }
  });

  useEffect(() => {
    try {
      setLevel(levelId);
    } catch {}
  }, [levelId]);

  const level = useMemo(() => getLevelConfig(levelId), [levelId]);
  const passPct = level.passAllGreenPct ?? 80;
const CARD_H = 280; // fast height so all cards match exactly


const [sentence, setSentence] = useState(() => getNextSentence(getLevel()));
const [result, setResult] = useState(null);
const [selectedWordIdx, setSelectedWordIdx] = useState(null);
const [wordScores, setWordScores] = useState([]); // score100 per word index (null if not scored yet)
const [targetWordIdx, setTargetWordIdx] = useState(0); // which word we are currently scoring


// --- Swipe carousel (prev/current/next) ---
const [cardIndex, setCardIndex] = useState(1); // 0=prev, 1=current, 2=next (we keep current centered)
const [prevSentence, setPrevSentence] = useState(null);
const [nextSentence, setNextSentence] = useState(null);

// keep a lightweight history so we can go back visually without breaking the level system too much
const historyRef = useRef([]); // sentences you've visited (strings)
const isRestoringRef = useRef(false);
const [interactionTick, setInteractionTick] = useState(0);

// ✅ Audio unlock (required for autoplay in browsers)
const userInteractedRef = useRef(false);
const audioUnlockedRef = useRef(false);

async function unlockAudioOnce() {
  if (audioUnlockedRef.current) return;
  audioUnlockedRef.current = true;

  // 1) Resume WebAudio context (if you use analyser/waveform)
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!ttsCtxRef.current && AudioCtx) {
      ttsCtxRef.current = new AudioCtx();
    }
    const ctx = ttsCtxRef.current;
    if (ctx && ctx.state === "suspended") await ctx.resume();
  } catch {}

  // 2) Prime <audio> element with a "gesture-approved" play attempt
  try {
    const a = ttsAudioRef.current;
    if (!a) return;

    const prevMuted = a.muted;
    a.muted = true;

    // Tiny silent wav (very short) to satisfy gesture policy
    a.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

    const p = a.play();
    if (p && typeof p.then === "function") {
      await p.catch(() => {});
    }
    a.pause();
    a.currentTime = 0;

    // Clean up
    a.removeAttribute("src");
    a.load();
    a.muted = prevMuted;
  } catch {}
}


const seenSentenceRef = useRef(new Set()); // session-only: sentences already shown (no autoplay on revisit)
const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
const [hydrated, setHydrated] = useState(false);

useEffect(() => {
  const mark = async () => {
  if (!userInteractedRef.current) {
    userInteractedRef.current = true;

    // ✅ unlock audio once on first real user gesture
    await unlockAudioOnce();

    // ✅ trigger rerender so autoplay effect can run
    setInteractionTick((t) => t + 1);
  }
};


  window.addEventListener("pointerdown", mark, { passive: true });
  window.addEventListener("keydown", mark);

  return () => {
    window.removeEventListener("pointerdown", mark);
    window.removeEventListener("keydown", mark);
  };
}, []);



// Always start fresh on hard refresh (new shuffle / new first sentence)
const PSM_PAGE_STATE_KEY = "ac_psm_page_state_v1";



function loadPageState() {
  try {
    return JSON.parse(localStorage.getItem(PSM_PAGE_STATE_KEY) || "null");
  } catch {
    return null;
  }
}
function savePageState(next) {
  try {
    localStorage.setItem(PSM_PAGE_STATE_KEY, JSON.stringify(next));
  } catch {}
}

useEffect(() => {
  const stored = loadPageState();
  console.log("PSM RESTORE", {
    storedHasResult: !!stored?.result,
    storedWordScoresLen: stored?.wordScores?.length,
    storedSentence: stored?.sentence,
  });

  try {
    // ✅ mark we're restoring so "sentence/levelId" effects don't wipe state
    isRestoringRef.current = !!stored;

    // If we have any stored state, ALWAYS restore it
    if (stored?.levelId && LEVELS.some((l) => l.id === stored.levelId)) {
      setLevelIdState(stored.levelId);
      try {
        setLevel(stored.levelId);
      } catch {}
    }

    if (stored?.sentence) setSentence(stored.sentence);

    // history / prev peek
    historyRef.current = Array.isArray(stored?.history) ? stored.history : [];
    setPrevSentence(historyRef.current.length ? historyRef.current[historyRef.current.length - 1] : null);

    // feedback state ✅
    setResult(stored?.result ?? null);
    setSelectedWordIdx(Number.isFinite(stored?.selectedWordIdx) ? stored.selectedWordIdx : null);
    setErr(stored?.err ?? "");

    // extra UI state
    setWordScores(Array.isArray(stored?.wordScores) ? stored.wordScores : []);
    setTargetWordIdx(Number.isFinite(stored?.targetWordIdx) ? stored.targetWordIdx : 0);

    // keep carousel stable
    setNextSentence(" ");
    setCardIndex(1);
  } catch {
    // fallback: whatever the bank says (only if no stored state)
    try {
      setSentence(getNextSentence(levelId));
    } catch {}
  }  
  // ✅ IMPORTANT: finish restore AFTER first paint
  requestAnimationFrame(() => {
    isRestoringRef.current = false;
    setHydrated(true);
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);




useEffect(() => {
    if (!hydrated) return;
  if (isRestoringRef.current) return;

  // gem kun når vi faktisk har en sentence
  if (!sentence) return;

  savePageState({
  levelId,
  sentence,
  history: historyRef.current || [],
  result,
  selectedWordIdx,
  err,

  // keep EXACT UI state
  wordScores,
  targetWordIdx,

  ts: Date.now(),
});
console.log("PSM SAVE", { hasResult: !!result, wordScoresLen: wordScores?.length, sentence });

}, [levelId, sentence, result, selectedWordIdx, err, wordScores, targetWordIdx]);




useEffect(() => {
    if (!hydrated) return;
  if (isRestoringRef.current) return;

  const prev = historyRef.current.length
    ? historyRef.current[historyRef.current.length - 1]
    : null;

  // ✅ hård reset: hvis vi er på "første", så må der aldrig vises prev card
  if (!prev) setPrevSentence(null);
  else setPrevSentence(prev);

    setNextSentence(" ");
  setCardIndex(1);

  // ✅ Do NOT wipe restored feedback state
    // ✅ only reset "practice-mode" state when we're NOT in feedback-mode
  // (goNextManual/goPrevManual already setResult(null), so this runs on real navigation)
  if (!result) {
    setWordScores([]);
    setTargetWordIdx(0);
  }
}, [sentence, levelId, result]);


  
  // Accent chooser (actual SpeechSuper dialect)
  const [accent, setAccent] = useState(() => settings?.accentDefault || "en_us");

  // recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingStartedAtRef = useRef(0);

  
  // live meter
  const [meterLevel, setMeterLevel] = useState(0);
  const [meterTick, setMeterTick] = useState(0);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataRef = useRef(null);
  const rafRef = useRef(null);

  // word details
  

  const passed = useMemo(() => isAllGreen(result, passPct), [result, passPct]);
  const ttsPlayedRef = useRef(false);
  const ttsAudioRef = useRef(null);
    // Keep TTS <audio> volume in sync with global settings
  useEffect(() => {
    const a = ttsAudioRef.current;
    if (!a) return;

    const v = Number(settings?.volume);
    a.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6;
  }, [settings?.volume]);

const ttsCtxRef = useRef(null);
const ttsAnalyserRef = useRef(null);
const ttsRafRef = useRef(null);
const ttsSourceRef = useRef(null);

const [ttsBars, setTtsBars] = useState(() => Array.from({ length: 32 }, () => 6));
const [ttsDurationSec, setTtsDurationSec] = useState(10);
const [ttsPlaying, setTtsPlaying] = useState(false);
const [ttsAudioUrl, setTtsAudioUrl] = useState(null);
const [ttsLoading, setTtsLoading] = useState(false);
const ttsAbortRef = useRef(null);


async function playSentenceTTS() {
  try {
    setErr("");
    if (ttsLoading) return;


    const audio = ttsAudioRef.current;
    if (!audio) return;

    // hvis vi allerede har en url for den sentence, så bare play den
    if (ttsAudioUrl) {
      stopTTSWaveform();
      audio.src = ttsAudioUrl;
      audio.currentTime = 0;

      audio.onloadedmetadata = () => {
        const d = Number(audio.duration);
        if (isFinite(d) && d > 0) setTtsDurationSec(d);
      };

      audio.onplay = () => {
        setTtsPlaying(true);
        startTTSWaveform();
      };

      audio.onended = () => stopTTSWaveform();

      const v = Number(settings?.volume);
audio.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6;


      await audio.play();
      return;
    }

    // ellers hent fra align-tts (Azure flow som i PhonemeFeedback)
    setTtsLoading(true);

    // abort evt. tidligere request
    try {
      ttsAbortRef.current?.abort?.();
    } catch {}
    const ac = new AbortController();
    ttsAbortRef.current = ac;

    const base = getApiBase();
    const res = await fetch(`${base}/api/align-tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify({
        refText: String(sentence || "").trim(),
        accent: accent || "en_us",
        ttsRate: 0.9, // samme idé som side 1
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "align-tts failed");

  const mime = json?.mime || "audio/mpeg";
const b64 = json?.audioBase64 || "";
console.log("TTS mime:", json?.mime);
console.log("TTS b64 starts:", String(b64).slice(0, 40));

if (!b64) throw new Error("No audio returned from align-tts");

const url = base64ToBlobUrl(b64, mime);


    // gem url og spil
    setTtsAudioUrl((prev) => {
      try {
        if (prev) URL.revokeObjectURL(prev);
      } catch {}
      return url;
    });

    stopTTSWaveform();

    audio.src = url;
    audio.onerror = () => {
  const code = audio?.error?.code;
  setErr(`Audio error (code ${code || "?"}). Unsupported source or corrupted audio.`);
};

    audio.currentTime = 0;

    audio.onloadedmetadata = () => {
      const d = Number(audio.duration);
      if (isFinite(d) && d > 0) setTtsDurationSec(d);
    };

    audio.onplay = () => {
      setTtsPlaying(true);
      startTTSWaveform();
    };

    audio.onended = () => stopTTSWaveform();

const v = Number(settings?.volume);
audio.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6;


    await audio.play();
  } catch (e) {
    stopTTSWaveform();
    setErr(e?.message || String(e));
  } finally {
    setTtsLoading(false);
  }
}


function stopTTSWaveform() {
  try {
    if (ttsRafRef.current) cancelAnimationFrame(ttsRafRef.current);
  } catch {}
  ttsRafRef.current = null;

  // Disconnect analyser so we can reconnect cleanly
  try {
    ttsAnalyserRef.current?.disconnect?.();
  } catch {}

  // DO NOT close the AudioContext (closing forces re-create source node, which is illegal)
  try {
    if (ttsCtxRef.current?.state === "running") ttsCtxRef.current.suspend?.();
  } catch {}

  setTtsPlaying(false);
}


function startTTSWaveform() {
  const audio = ttsAudioRef.current;
  if (!audio) return;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;

  // Create context once
  if (!ttsCtxRef.current) {
    ttsCtxRef.current = new AudioCtx();
  }

  const ctx = ttsCtxRef.current;

  // Resume if suspended
  try {
    if (ctx.state === "suspended") ctx.resume?.();
  } catch {}

  // Create source ONCE per <audio> element (critical!)
  if (!ttsSourceRef.current) {
    try {
      ttsSourceRef.current = ctx.createMediaElementSource(audio);
    } catch (e) {
      // If this fails, don't crash the page
      console.log("createMediaElementSource failed:", e);
      return;
    }
  }

  // Create analyser once
  if (!ttsAnalyserRef.current) {
    ttsAnalyserRef.current = ctx.createAnalyser();
    ttsAnalyserRef.current.fftSize = 1024;
  }

  const analyser = ttsAnalyserRef.current;

  // Clean reconnect (avoid stacking connections)
  try {
    analyser.disconnect();
  } catch {}
  try {
    ttsSourceRef.current.disconnect();
  } catch {}

  // Reconnect
  try {
    ttsSourceRef.current.connect(analyser);
    analyser.connect(ctx.destination);
  } catch (e) {
    console.log("connect failed:", e);
    return;
  }

  const data = new Uint8Array(analyser.frequencyBinCount);

  const loop = () => {
    const a = ttsAnalyserRef.current;
    if (!a) return;

    a.getByteFrequencyData(data);

    const bars = [];
    const nBars = 32;
    const step = Math.floor(data.length / nBars);

    for (let i = 0; i < nBars; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
      const avg = sum / step;
      const h = 4 + Math.round((avg / 255) * 22);
      bars.push(h);
    }

    setTtsBars(bars);
    ttsRafRef.current = requestAnimationFrame(loop);
  };

  ttsRafRef.current = requestAnimationFrame(loop);
}

useEffect(() => {
  // Abort any in-flight TTS request
  try {
    ttsAbortRef.current?.abort?.();
  } catch {}
  ttsAbortRef.current = null;

  // Stop waveform + reset UI
  stopTTSWaveform();
  setTtsBars(Array.from({ length: 32 }, () => 6));
  setTtsDurationSec(10);
  setTtsPlaying(false);

  // Revoke old blob url and clear cache so next sentence fetches fresh
  setTtsAudioUrl((prev) => {
    try {
      if (prev) URL.revokeObjectURL(prev);
    } catch {}
    return null;
  });

  // Stop audio element
  const a = ttsAudioRef.current;
  if (a) {
    try {
      a.pause();
      a.currentTime = 0;
      a.removeAttribute("src");
      a.load();
    } catch {}
  }

  // OPTIONAL: prefetch immediately (no autoplay, just cache the blob url)
  // This makes the first click feel instant.
  (async () => {
    try {
      setTtsLoading(true);

      const ac = new AbortController();
      ttsAbortRef.current = ac;

      const base = getApiBase();
      const res = await fetch(`${base}/api/align-tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          refText: String(sentence || "").trim(),
          accent: accent || "en_us",
          ttsRate: 0.9,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "align-tts failed");

      const mime = json?.mime || "audio/mpeg";
const b64 = json?.audioBase64 || "";
if (!b64) throw new Error("No audio returned from align-tts");

const url = base64ToBlobUrl(b64, mime);


      setTtsAudioUrl((prev) => {
  try { if (prev) URL.revokeObjectURL(prev); } catch {}
  return url;
});
    } catch (e) {
      // ignore aborts
      if (String(e?.name || "").toLowerCase().includes("abort")) return;
      console.log("prefetch align-tts failed:", e);
    } finally {
      setTtsLoading(false);
    }
  })();

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sentence, accent]);




  // auto-next + auto-level-up
  useEffect(() => {
  if (!passed) return;

  // auto-advance: same as manual next
  
  try {
    const prev = Number(localStorage.getItem(CLEARS_KEY) || "0");
    const next = prev + 1;

    if (next >= CLEARS_PER_LEVEL_UP) {
      localStorage.setItem(CLEARS_KEY, "0");
      const idx = LEVELS.findIndex((l) => l.id === levelId);
      if (idx < LEVELS.length - 1) {
        const nextLevel = LEVELS[idx + 1].id;
        resetLevel(nextLevel);
        setLevelIdState(nextLevel);
      }
    } else {
      localStorage.setItem(CLEARS_KEY, String(next));
    }
  } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [passed]);

useEffect(() => {
  let lock = false;
  let last = 0;

  function onWheel(e) {
    // kun hvis det er mest horisontalt
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;

    // stop browser "back/forward" feeling / page scroll
    e.preventDefault();

    const now = Date.now();
    if (lock && now - last < 450) return; // debounce
    last = now;

    const dx = e.deltaX;

    // Trackpad: typisk små mange events -> kræver threshold
    if (dx > 35) {
      lock = true;
      goNextManual();
      setTimeout(() => (lock = false), 250);
    } else if (dx < -35) {
      lock = true;
      if (historyRef.current.length) goPrevManual();
      setTimeout(() => (lock = false), 250);
    }
  }

  // IMPORTANT: passive false, ellers kan vi ikke preventDefault
  window.addEventListener("wheel", onWheel, { passive: false });
  return () => window.removeEventListener("wheel", onWheel);
}, []);


  function startLiveMeter(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      dataRef.current = data;

      const loop = () => {
        const a = analyserRef.current;
        const d = dataRef.current;
        if (!a || !d) return;

        a.getByteTimeDomainData(d);

        let sum = 0;
        for (let i = 0; i < d.length; i++) {
          const v = (d[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / d.length);
        const level = Math.min(1, Math.max(0, rms * 2.2));

        setMeterLevel(level);
        setMeterTick((t) => (t + 1) % 1000000);

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setMeterLevel(0);
    }
  }

  function stopLiveMeter() {
    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } catch {}
    rafRef.current = null;

    try {
      audioCtxRef.current?.close?.();
    } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
    dataRef.current = null;

    setMeterLevel(0);
  }

  async function startRecording() {
    setErr("");
    setSelectedWordIdx(null);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    startLiveMeter(stream);

    const mimeType = pickBestMime();
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    chunksRef.current = [];
    recordingStartedAtRef.current = Date.now();

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onerror = (e) => setErr(e?.error?.message || "Recording error");

    mr.onstop = async () => {
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {}

      stopLiveMeter();

      const elapsed = Date.now() - (recordingStartedAtRef.current || Date.now());
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });

      chunksRef.current = [];
      mediaRef.current = null;

      if (!blob || blob.size < 2000 || elapsed < 250) {
        setIsRecording(false);
        setLoading(false);
        setErr("No audio captured. Hold the button a bit longer and try again.");
        return;
      }

      await analyzeBlob(blob);
    };

    mediaRef.current = mr;
    mr.start();
    setIsRecording(true);
  }

  async function stopRecording() {
    try {
      mediaRef.current?.stop();
    } catch {}
    setIsRecording(false);
  }

  async function analyzeBlob(audioBlob) {
    setLoading(true);
    setErr("");

    try {
      const base = getApiBase();

      const fd = new FormData();
      fd.append("refText", normalizeRefText(sentence));
      fd.append("accent", accent);
      fd.append("audio", audioBlob, "clip.webm");

      const res = await fetch(`${base}/api/analyze-speech`, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "analyze-speech failed");

     setResult(json);
setSelectedWordIdx(null);

// Extract a stable "overall" score like Record (0-100)
// ✅ PF-like word scoring (duration-weighted phonemes)
// ✅ PF-like word scoring for the whole sentence
const apiWords = Array.isArray(json?.words) ? json.words : [];

// Map scores onto displayWords WITHOUT breaking when punctuation exists
let apiIdx = 0;
const nextScores = displayWords.map((dw) => {
  const t = String(dw?.text || "");
  const isPunctOnly = !!t && !/[A-Za-z0-9]/.test(t);
  if (isPunctOnly) return null;

  const w = apiWords[apiIdx++];
  return w ? wordScore100LikePF(w) : null;
});

setWordScores(nextScores);

// sentence mode: no per-word target stepping
setTargetWordIdx(0);


    } catch (e) {
      setResult(null);
      setSelectedWordIdx(null);
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

async function onMicClick() {
  userInteractedRef.current = true;
  await unlockAudioOnce();
  setInteractionTick((t) => t + 1);



    if (loading) return;
    try {
      if (!isRecording) await startRecording();
      else await stopRecording();
    } catch (e) {
      setErr(e?.message || String(e));
      setIsRecording(false);
    }
  }

const displayWords = useMemo(() => {
  const raw = String(sentence || "").trim();
  let parts = raw.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    const cleaned = raw
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Za-z])([0-9])/g, "$1 $2")
      .replace(/([0-9])([A-Za-z])/g, "$1 $2")
      .replace(/([.,!?;:])/g, " $1 ")
      .replace(/\s+/g, " ")
      .trim();

    parts = cleaned.split(/\s+/).filter(Boolean);
  }

  return parts.map((t, idx) => ({
    key: `sent-${idx}`,
    text: t,
    score100: Number.isFinite(wordScores?.[idx]) ? wordScores[idx] : null,
    phonemes: [], // (valgfrit) kan udfyldes når du åbner detaljer
  }));
}, [sentence, wordScores]);



const targetRefText = useMemo(() => {
  const t = displayWords?.[targetWordIdx]?.text;
  return normalizeRefText(t || "");
}, [displayWords, targetWordIdx]);



  const selectedWord = useMemo(() => {
    if (selectedWordIdx == null) return null;
    return displayWords[selectedWordIdx] || null;
  }, [selectedWordIdx, displayWords]);
  function displayIdxToApiIdx(displayIdx) {
  let apiIdx = 0;
  for (let i = 0; i < displayWords.length; i++) {
    const t = String(displayWords[i]?.text || "");
    const isPunctOnly = !!t && !/[A-Za-z0-9]/.test(t);
    if (isPunctOnly) continue;

    if (i === displayIdx) return apiIdx;
    apiIdx++;
  }
  return null;
}

const selectedApiWord = useMemo(() => {
  if (!result || selectedWordIdx == null) return null;
  const apiWords = Array.isArray(result?.words) ? result.words : [];
  const apiIdx = displayIdxToApiIdx(selectedWordIdx);
  if (apiIdx == null) return null;
  return apiWords[apiIdx] || null;
}, [result, selectedWordIdx, displayWords]);


function phonemeTip(ph) {
  const p = String(ph || "").toUpperCase();

  // ARPAbet-ish quick tips (extend over time)
  const tips = {
    S: "Make the /s/ crisp: steady airflow, no voicing.",
    Z: "Add voicing for /z/: it’s like /s/ but with vibration.",
    N: "Nasal /n/: tongue touches the ridge behind upper teeth, air through nose.",
    D: "Light /d/: quick tongue tap behind upper teeth (don’t over-release).",
    T: "Crisp /t/: quick tongue contact, minimal extra air (unless aspirated).",
    R: "American /r/: tongue pulled back slightly, lips relaxed (no trilling).",
    L: "Clear /l/: tongue up behind teeth; don’t swallow the vowel after it.",
    AW: "For /aw/: start with 'a' then round lips into 'oo' (smooth glide).",
    OW: "For /ow/: start neutral then round lips (don’t make it too flat).",
    AE: "For /æ/: open mouth more (like 'cat'), keep it short.",
    AH: "For /ʌ/ /ah/: relaxed jaw, central vowel (not too rounded).",
    IH: "For /ɪ/: short, relaxed vowel (like 'sit'), not 'ee'.",
    IY: "For /i:/: smile slightly, long 'ee' vowel (like 'see').",
  };

  return tips[p] || `Focus on the "${ph}" sound: slow down and exaggerate it slightly.`;
}

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


function cmuChipLabel(sym) {
  const t = String(sym || "").trim().toUpperCase();
  if (!t) return "";
  return CMU_HELP[t] || t;
}


function buildWrittenFeedbackForWord(word) {
  const phonemes = Array.isArray(word?.phonemes) ? word.phonemes : [];
  if (!phonemes.length) return [];

  // build list with scores
  const scored = phonemes
    .map((p) => {
      const s01 = clamp01(
        p.pronunciation ??
          p.accuracy_score ??
          p.pronunciation_score ??
          p.score ??
          p.accuracy ??
          p.accuracyScore
      );
      const s100 = s01 == null ? null : Math.round(s01 * 100);
      return { ph: p.ph || p.phoneme, s100 };
    })
    .filter((x) => x.ph);

  if (!scored.length) return [];

  // pick worst 2–3 phonemes (ignoring nulls)
// ALL issues = every phoneme we have a score for (KEEP original order)
const ordered = scored.filter((x) => x.s100 != null);
if (!ordered.length) return [];

return ordered.map((w) => {
  const raw = String(w.ph || "").toUpperCase();
const label = cmuChipLabel(raw);
return `${label} (${w.s100}%): ${phonemeTip(raw)}`;
});


}


  // Theme-safe score colors
  function scoreToColor(score100) {
  const s = Number(score100);
  if (!isFinite(s)) return "var(--text)";
  const x = Math.max(0, Math.min(1, s / 100));
  return `hsl(${x * 120}deg 75% 45%)`;
}


  const MicIcon = (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 11a7 7 0 0 1-14 0"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 18v3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 21h8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const statusText = isRecording ? "Listening…" : loading ? "Analyzing…" : "Ready";
function goNextManual() {
  // allow next even if not all green
  historyRef.current.push(sentence);

  advanceSentence(levelId);
  setResult(null);
  setErr("");
  setSelectedWordIdx(null);
  setSentence(getNextSentence(levelId));
}

function goPrevManual() {
  if (!historyRef.current.length) return;

  // move the bank pointer back
  backSentence(levelId);

  // pop sentence we’re going back to
  const prev = historyRef.current.pop();

  // compute what should be on the left AFTER going back
  const leftPeek =
    historyRef.current.length ? historyRef.current[historyRef.current.length - 1] : null;

  // update UI state
  setResult(null);
  setErr("");
  setSelectedWordIdx(null);

  // IMPORTANT: force prev peek state immediately (prevents stale left card)
  setPrevSentence(leftPeek);

  // keep "Next" peek consistent
  setNextSentence(" ");
  setCardIndex(1);

  // now set the sentence
  setSentence(prev);
}


async function onCardPointerDown(e) {
  userInteractedRef.current = true;
  await unlockAudioOnce();
  setInteractionTick((t) => t + 1);



  console.log("CARD POINTER DOWN", e.target, e.currentTarget);
const el = document.elementFromPoint(e.clientX, e.clientY);
console.log("TOP ELEMENT AT POINT:", el);

  // venstre klik only
  if (e.button != null && e.button !== 0) return;

  // ✅ If user clicked an interactive element (Play button / word buttons etc),
  // don't start swipe (otherwise we kill the click)
  const interactive = e.target?.closest?.("button, a, input, textarea, select, [role='button']");
  if (interactive) return;
  // ✅ iOS/WKWebView: ensure we keep receiving move/up events
  try {
    swipeRef.current.pointerId = e.pointerId;
    swipeRef.current.el = e.currentTarget;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  } catch {}


  swipeRef.current.active = true;
  swipeRef.current.x0 = e.clientX;
  swipeRef.current.y0 = e.clientY;
  swipeRef.current.xLast = e.clientX;
swipeRef.current.yLast = e.clientY;

  // stop text-selection drag
  try {
    e.preventDefault();
  } catch {}
}

function onCardPointerMove(e) {
  if (!swipeRef.current.active) return;
  swipeRef.current.xLast = e.clientX;
  swipeRef.current.yLast = e.clientY;
}


function cleanupCardPointerListeners() {
    // ✅ release pointer capture
  try {
    const el = swipeRef.current.el;
    const pid = swipeRef.current.pointerId;
    if (el && pid != null) el.releasePointerCapture?.(pid);
  } catch {}
  swipeRef.current.el = null;
  swipeRef.current.pointerId = null;

  swipeRef.current.xLast = null;
swipeRef.current.yLast = null;

}

function onCardPointerUp(e) {
  if (!swipeRef.current.active) {
    cleanupCardPointerListeners();
    return;
  }

  swipeRef.current.active = false;
  cleanupCardPointerListeners();

 const x1 = swipeRef.current.xLast ?? e.clientX;
const y1 = swipeRef.current.yLast ?? e.clientY;

const dx = x1 - swipeRef.current.x0;
const dy = y1 - swipeRef.current.y0;


  // kun horisontal swipe
 if (Math.abs(dx) < 35) return;
if (Math.abs(dx) <= Math.abs(dy) + 5) return;


  if (dx > 0) {
    goNextManual();
  } else {
    if (historyRef.current.length) goPrevManual();
  }
}

function onCardPointerCancel() {
  swipeRef.current.active = false;
  cleanupCardPointerListeners();
}

function onCardTouchStart(e) {
  // Hvis man trykker på knapper/inputs osv, så ikke swipe
  const interactive = e.target?.closest?.("button, a, input, textarea, select, [role='button']");
  if (interactive) return;

  const t = e.touches?.[0];
  if (!t) return;

  swipeRef.current.active = true;
  swipeRef.current.x0 = t.clientX;
  swipeRef.current.y0 = t.clientY;
  swipeRef.current.xLast = t.clientX;
  swipeRef.current.yLast = t.clientY;
}

function onCardTouchMove(e) {
  if (!swipeRef.current.active) return;
  const t = e.touches?.[0];
  if (!t) return;

  swipeRef.current.xLast = t.clientX;
  swipeRef.current.yLast = t.clientY;
}

function onCardTouchEnd(e) {
  if (!swipeRef.current.active) return;
  swipeRef.current.active = false;

  const x1 = swipeRef.current.xLast ?? swipeRef.current.x0;
  const y1 = swipeRef.current.yLast ?? swipeRef.current.y0;

  const dx = x1 - swipeRef.current.x0;
  const dy = y1 - swipeRef.current.y0;

  // kun horisontal swipe
  if (Math.abs(dx) < 35) return;
  if (Math.abs(dx) <= Math.abs(dy) + 5) return;

  if (dx > 0) {
    goNextManual();
  } else {
    if (historyRef.current.length) goPrevManual();
  }
}


  return (
    <div className="page" style={{ textAlign: "center" }}>
      <div className="mx-auto w-full max-w-[980px]">
        <audio ref={ttsAudioRef} preload="auto" />

        {/* Title */}
        <div style={{ marginTop: 6 }}>
          <div className="page-title" style={{ fontSize: 18, fontWeight: 900, color: "var(--text)",
 }}>
  Pronunciation Coach
</div>


          {/* Controls row (NO panel) */}
          <div
            className="mt-5"
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 14,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <select
              value={levelId}
              onChange={(e) => {
                const next = e.target.value;
                setLevelIdState(next);
                historyRef.current = [];
setPrevSentence(null);
setNextSentence(null);
setCardIndex(1);
                setResult(null);
                setErr("");
                setSelectedWordIdx(null);
                setSentence(getNextSentence(next));

              }}
              className="select-pill"
              style={{ fontWeight: 800 }}
            >
              {LEVELS.map((l, idx) => (
                <option key={l.id} value={l.id}>
                  Level {idx + 1}
                </option>
              ))}
            </select>

            <select
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="select-pill"
              style={{ fontWeight: 800 }}
              title="Accent"
            >
              <option value="en_us">🇺🇸 American English</option>
              <option value="en_br">🇬🇧 British English</option>
            </select>

           
          </div>
        </div>

        {/* Centered content (NO cards) */}
        <div
          style={{
            minHeight: "72vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginTop: 10,
            paddingBottom: 10,
          }}
        >
          {/* Sentence swipe carousel */}
<div
  style={{
    width: "min(860px, 100vw)",
    overflow: "hidden",
    padding: "0 18px", // makes the side-peek visible
  }}
>
  <div
    style={{
      display: "flex",
      gap: 18,
      justifyContent: "center",
      touchAction: "pan-y",
    }}
  >
    {/* PREV (peek) */}
{prevSentence ? (
  <div
  role="button"
  tabIndex={0}
  onClick={() => {
    if (historyRef.current.length) goPrevManual();
  }}
  onKeyDown={(e) => {
    if ((e.key === "Enter" || e.key === " ") && historyRef.current.length) {
      e.preventDefault();
      goPrevManual();
    }
  }}
  style={{
    width: "min(520px, 92vw)",
    flex: "0 0 auto",
    transform: "scale(0.98)",
    cursor: historyRef.current.length ? "pointer" : "default",
    userSelect: "none",
  }}
>

    <div
      style={{
        background: "#fff",
        borderRadius: 24,
        boxShadow: "0 20px 40px rgba(0,0,0,0.06)",
        padding: "28px 24px",
        textAlign: "center",
        height: CARD_H,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, color: "rgba(0,0,0,0.35)" }}>Previous</div>
      <div style={{ marginTop: 14, fontSize: 22, fontWeight: 900, color: "rgba(17,24,39,0.70)" }}>
        {prevSentence}
      </div>
      
    </div>
  </div>
) : (
  // no left card on the first sentence (keep spacing identical)
  <div
    style={{
      width: "min(520px, 92vw)",
      flex: "0 0 auto",
      height: CARD_H,
          // <-- IMPORTANT: same height as cards
    }}
  />
)}



    {/* CURRENT (real interactive card) */}
    <div style={{ width: "min(520px, 92vw)", flex: "0 0 auto" }}>
      <div
      
onPointerDown={onCardPointerDown}
  onPointerMove={onCardPointerMove}
  onPointerUp={onCardPointerUp}
  onPointerCancel={onCardPointerCancel}

onTouchStart={onCardTouchStart}
onTouchMove={onCardTouchMove}
onTouchEnd={onCardTouchEnd}



        style={{
          background: "#fff",
          borderRadius: 24,
          boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
          padding: "28px 24px",
          height: CARD_H,
display: "flex",
flexDirection: "column",
justifyContent: "center",
          textAlign: "center",
          cursor: "grab",
userSelect: "none",
WebkitUserSelect: "none",
touchAction: "pan-y",
overscrollBehaviorX: "contain",
WebkitTouchCallout: "none",
pointerEvents: "auto",
WebkitUserDrag: "none",


        }}
      >
        {result ? (
          <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: "rgba(0,0,0,0.45)" }}>
            Tip: Click red/orange words to see exactly what to improve.
          </div>
        ) : null}

        <div
          style={{
            fontSize: 40,
            fontWeight: 900,
            marginBottom: 18,
            lineHeight: 1.12,
            textAlign: "center",
            wordBreak: "break-word",
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 10,
            color: "rgba(17,24,39,0.95)",
          }}
        >
          {displayWords.map((w, idx) => {
            const color = w.score100 != null ? scoreToColor(w.score100) : "rgba(17,24,39,0.95)";
            const isSelected = idx === selectedWordIdx;

            return (
              <button
                key={w.key}
                  onPointerDown={(e) => e.stopPropagation()}   // ✅ IMPORTANT
onTouchStart={(e) => e.stopPropagation()}

               onClick={() => {
  // If we don't have a result yet, clicking selects which word to score (Record-style)
  if (!result) {
    setTargetWordIdx(idx);
    return;
  }
  // If we DO have a result, clicking opens details for that word
  setSelectedWordIdx(idx);
}}

                disabled={false}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  margin: 0,
                  cursor: result ? "pointer" : "default",
                  color,
                  textDecoration: result ? (isSelected ? "underline" : "none") : "none",

                  textUnderlineOffset: 6,
                }}
                title={w.score100 != null ? `${w.score100}%` : ""}
              >
                {w.text}
              </button>
            );
          })}
        </div>

        {/* Play + waveform */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onPointerDown={(e) => e.stopPropagation()}   // ✅ IMPORTANT
           onTouchStart={(e) => e.stopPropagation()}
            onClick={playSentenceTTS}
            disabled={ttsLoading}
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "none",
              background: "#FFB703",
              display: "grid",
              placeItems: "center",
              cursor: ttsLoading ? "not-allowed" : "pointer",
              opacity: ttsLoading ? 0.6 : 1,
            }}
            aria-label="Play sentence"
          >
            {ttsLoading ? "…" : "▶"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3, flex: 1, height: 22 }} aria-hidden="true">
              {ttsBars.map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 3,
                    height: h,
                    borderRadius: 999,
                    background: ttsPlaying ? "rgba(255,183,3,0.85)" : "rgba(0,0,0,0.16)",
                    opacity: ttsPlaying ? 1 : 0.7,
                    transition: "height 60ms linear",
                  }}
                />
              ))}
            </div>

            <div style={{ fontWeight: 900, color: "rgba(0,0,0,0.35)", fontSize: 14 }}>
              {`0:${String(Math.round(ttsDurationSec)).padStart(2, "0")}`}
            </div>
          </div>
        </div>

        {/* hint row */}
        <div style={{ marginTop: 14, fontSize: 12, fontWeight: 900, color: "rgba(0,0,0,0.35)" }}>
          Swipe right for next • Swipe left for previous
        </div>
      </div>
    </div>

  {/* NEXT (peek) */}
<div
  role="button"
  tabIndex={0}
  onClick={() => goNextManual()}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goNextManual();
    }
  }}
  style={{
    width: "min(520px, 92vw)",
    flex: "0 0 auto",
    opacity: 0.55,
    transform: "scale(0.98)",
    cursor: "pointer",
    userSelect: "none",
  }}
>
  <div
    style={{
      background: "#fff",
      borderRadius: 24,
      boxShadow: "0 20px 40px rgba(0,0,0,0.06)",
      padding: "28px 24px",
      textAlign: "center",
      height: CARD_H,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    }}
  >
    <div style={{ fontSize: 13, fontWeight: 900, color: "rgba(0,0,0,0.35)" }}>Next</div>
    <div style={{ marginTop: 18, fontSize: 22, fontWeight: 900, color: "rgba(17,24,39,0.70)" }}>
  Next →
</div>

    <div style={{ marginTop: 14, fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.35)" }}>
      Auto-advances when all green
    </div>
  </div>
</div>


    </div>
  </div>



          {/* Status (NO panel) */}
          <div
            style={{
              minHeight: 58,
              display: "grid",
              placeItems: "center",
              gap: 8,
            }}
            aria-live="polite"
          >
            {isRecording ? (
              <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                <div style={{ fontWeight: 900, color: "var(--muted)" }}>{statusText}</div>

                <div
                  style={{
                    width: 240,
                    height: 22,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    gap: 3,
                  }}
                >
                  {Array.from({ length: 18 }).map((_, i) => {
                    const wave = 0.35 + 0.65 * Math.abs(Math.sin(meterTick / 10 + i * 0.55));
                    const h = 4 + Math.round(18 * Math.min(1, meterLevel * 1.15) * wave);

                    return (
                      <div
                        key={i}
                        style={{
                          width: 8,
                          height: h,
                          borderRadius: 999,
                          background: "rgba(33,150,243,0.85)",
                          opacity: 0.35 + 0.65 * meterLevel,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ) : loading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900, color: "var(--muted)" }}>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    border: "3px solid rgba(255,255,255,0.20)",
                    borderTopColor: "rgba(33,150,243,0.95)",
                    animation: "acSpin 0.9s linear infinite",
                  }}
                />
                {statusText}
              </div>
            ) : (
              <div style={{ fontWeight: 900, color: "var(--muted)" }}>{statusText}</div>
            )}
          </div>
<div
   style={{
     position: "relative",
     display: "grid",
     placeItems: "center",
     marginTop: 40,      // <-- pushes mic + bubble down
     paddingBottom: 10,  // optional
   }}
 >  {!result && (
    <div
      style={{
  position: "absolute",
  bottom: "calc(100% + 9px)",
  left: "50%",
  transform: "translateX(-50%)",
  background: "white",
  padding: "8px 18px",
  borderRadius: 18,
  fontWeight: 800,
  fontSize: 14,
  lineHeight: 1.2,
  color: "rgba(0,0,0,0.62)",
  boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
  maxWidth: 360,
  whiteSpace: "nowrap",
  textAlign: "center",
}}

    >
      Repeat the word after pressing the button

      {/* Bubble arrow */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: -6,
          transform: "translateX(-50%) rotate(45deg)",
          width: 12,
          height: 12,
          background: "white",
          boxShadow: "8px 8px 18px rgba(0,0,0,0.06)",
        }}
      />
    </div>
  )}

  {/* Mic (primary CTA) */}
  <button
    onClick={onMicClick}
    disabled={loading}
    aria-label={isRecording ? "Stop recording" : "Start recording"}
    style={{
      width: 88,
      height: 88,
      borderRadius: 9999,
      border: "none",
      cursor: loading ? "not-allowed" : "pointer",
      background: isRecording ? "rgba(33,150,243,0.92)" : "rgba(33,150,243,0.45)",
      boxShadow: isRecording
        ? "0 0 30px rgba(33,150,243,0.35)"
        : "0 0 28px rgba(33,150,243,0.25)",
      display: "grid",
      placeItems: "center",
      transition: "transform .08s ease",
      opacity: loading ? 0.7 : 1,
    }}
    onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
    onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
  >
    {MicIcon}
  </button>
</div>


          

         

          {/* Error */}
          {err ? (
            <div className="error" style={{ marginTop: 6 }}>
              {err}
            </div>
          ) : null}

          {/* Word details (single panel when opened) */}
          {result && selectedWord && selectedApiWord ? (
            <div className="panel" style={{ width: "min(860px, 92vw)", textAlign: "left", marginTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--panel-text)" }}>
                    Word: <span style={{ color: "var(--primary)" }}>{selectedWord.text}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>
                    Score: {selectedWord.score100 != null ? `${selectedWord.score100}%` : "—"}
                  {(() => {
  const lines = buildWrittenFeedbackForWord(selectedApiWord);
  if (!lines.length) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "var(--muted)", marginBottom: 6 }}>
        Written feedback (all issues)
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, textAlign: "left" }}>
        {lines.map((t, i) => (
          <li key={i} style={{ fontSize: 13, fontWeight: 800, color: "var(--panel-text)", marginBottom: 4 }}>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
})()}

                  </div>
                  

                </div>

                <button onClick={() => setSelectedWordIdx(null)} className="btn btn-ghost btn-sm">
                  Close
                </button>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(selectedApiWord.phonemes || []).slice(0, 24).map((p, i) => {
                  const s01 = clamp01(
                    p.pronunciation ??
                      p.accuracy_score ??
                      p.pronunciation_score ??
                      p.score ??
                      p.accuracy ??
                      p.accuracyScore
                  );
                  const s100 = s01 == null ? null : Math.round(s01 * 100);
                  const c = s100 == null ? "var(--panel-text)" : scoreToColor(s100);

                  return (
                    <div
                      key={`apiw-${selectedWordIdx}-ph-${i}`}
                      style={{
                        border: "1px solid var(--panel-border)",
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontWeight: 900,
                        color: c,
                        background: "rgba(255,255,255,0.04)",
                      }}
                      title={s100 != null ? `${s100}%` : ""}
                    >
                    {cmuChipLabel(p.ph || p.phoneme)}
{s100 != null ? ` · ${s100}%` : ""}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>
                If a phoneme is red, try again and click the word to see changes.
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* local keyframes (so we don’t rely on global) */}
      <style>{`
        @keyframes acSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
