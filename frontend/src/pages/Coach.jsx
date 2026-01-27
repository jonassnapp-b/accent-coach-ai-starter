// src/pages/Coach.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { ChevronDown, Mic, StopCircle, Volume2 } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useSettings } from "../lib/settings-store.jsx";

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
  "AH", "AO", "AX", "CH", "DH", "EH", "EY", "IH", "IX", "IY", "JH", "OH", "OY", "SH", "TH", "UH", "UW", "UX", "ZH", "AA",
]);

const AVAILABLE_AUDIO_BR = new Set([
  "AH", "AO", "AX", "EH", "EY", "IH", "IX", "IY", "JH", "OH", "OY", "SH", "TH", "UH", "UW", "UX", "ZH", "AA",
  // NOTE: CH is .ogg in din mappe -> iOS problem -> vi skipper, indtil du har CH.mp3
  // NOTE: DH.mp3 er ikke i dit screenshot -> hvis du har den, så tilføj "DH" her
]);

const AVAILABLE_AUDIO_US = new Set([
  // i dit screenshot har du kun AO_us.mp3 i en_us
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
  // try common fields (SpeechSuper varies)
  const v =
    obj?.accuracy ??
    obj?.pronunciation ??
    obj?.score ??
    obj?.overall ??
    obj?.overallAccuracy ??
    obj?.pronunciationAccuracy ??
    obj?.accuracyScore;

  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
  const [selectedWordIdx, setSelectedWordIdx] = useState(0);

  // recording
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isBusy = isRecording || isAnalyzing;

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

  // pop effect while the target is spoken
  const [isSpeakingTarget, setIsSpeakingTarget] = useState(false);

  useEffect(() => {
    // ✅ reset prewarm when accent changes (so voice can change)
    if (prewarmUrlRef.current) {
      try { URL.revokeObjectURL(prewarmUrlRef.current); } catch {}
      prewarmUrlRef.current = null;
      setPrewarmReady(false);
    }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentUi]);

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function disposeRecorder() {
    try {
      mediaRecRef.current?.stream?.getTracks()?.forEach((t) => t.stop());
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
    await new Promise((resolve) => {
      const done = () => resolve();
      a.onended = done;
      a.onerror = done;
    });
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

    if (myId !== ttsPlayIdRef.current) return;

    await a.play();
    await new Promise((resolve) => {
      const done = () => resolve();
      a.onended = done;
      a.onerror = done;
    });
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
    await sleep(100);
    setIsSpeakingTarget(true);
    try {
      await playTts(t, 0.98);
    } catch (e) {
      if (!IS_PROD) console.warn("[TTS target]", e);
    } finally {
      setIsSpeakingTarget(false);
    }
  }

  async function beginIntroThenFlow() {
    const t = buildNewTarget(mode, difficulty);
    setTarget(t);
    setResult(null);
    setStatus("");
    setSelectedWordIdx(0);

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
  setSelectedWordIdx(0);

  setStage("flow");      // ✅ ingen intro
  await speakSequence(t); // ✅ siger kun target
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
    setSelectedWordIdx(0);
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

      const payload = {
        ...json,
        userAudioUrl: localUrl,
        userAudioBlob: audioBlob,
        refText: target,
        accent: accentUi,
        createdAt: Date.now(),
      };

      setResult(payload);
      setSelectedWordIdx(0);

      const overall = Number(json?.overall ?? json?.overallAccuracy ?? json?.pronunciation ?? 0);
      const threshold = difficulty === "easy" ? 75 : difficulty === "medium" ? 82 : 88;

      if (overall >= threshold + 7) {
        setStatus("Well done ✅");
        await playTts("Well done. Let's go to the next one.");
        const next = buildNewTarget(mode, difficulty);
        setTarget(next);
        await speakSequence(next);
      } else if (overall >= threshold) {
        setStatus("That’s alright — next 👌");
        await playTts("That's alright. Let's go to the next one.");
        const next = buildNewTarget(mode, difficulty);
        setTarget(next);
        await speakSequence(next);
      } else {
        setStatus("Try again (listen to the feedback) 🔁");
        // ✅ removed: TTS that says "Try again"
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

  const safeWordIdx = Math.max(0, Math.min(selectedWordIdx, Math.max(0, (words?.length || 1) - 1)));
  const currentWordObj = words?.[safeWordIdx] || null;

  const currentWordText = String(currentWordObj?.word || currentWordObj?.text || currentWordObj?.name || target || "").trim();
  const currentWordScore = getScore(currentWordObj);

  const phonemeCards = useMemo(() => {
    const ps = Array.isArray(currentWordObj?.phonemes) ? currentWordObj.phonemes : [];
    const out = [];

    for (const p of ps) {
      const code = getPhonemeCode(p);
      if (!code) continue;

      const s = getScore(p);

      // "ikke grøn" => show only if not green (or unknown score)
      if (s != null && isGreen(s)) continue;

      const assets = resolvePhonemeAssets(code, accentUi);
      if (!assets) continue; // ✅ missing image => skip entirely (your rule)

      out.push({
        code,
        score: s,
        imgSrc: assets.imgSrc,
        audioSrc: assets.audioSrc, // optional
      });
    }

    return out;
  }, [currentWordObj, accentUi]);

  function playOverlayAudio(src) {
    if (!src) return;
    try {
      if (!overlayAudioRef.current) overlayAudioRef.current = new Audio();
      overlayAudioRef.current.pause();
      overlayAudioRef.current.currentTime = 0;
      overlayAudioRef.current.src = src;
      overlayAudioRef.current.play().catch(() => {});
    } catch {}
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
    background: LIGHT_SURFACE,
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
                    <span style={{ position: "relative", zIndex: 1 }}>{target || "—"}</span>
                  </span>
                </motion.div>

                <div style={{ display: "grid", placeItems: "center", marginTop: 52 }}>
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
                  <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.55, marginBottom: 6 }}>
                    Feedback
                  </div>

                  {/* Sentence word dropdown */}
                  {isSentence ? (
                    <div style={{ ...selectWrapStyle, marginBottom: 10 }}>
                      <select
                        aria-label="Word"
                        value={safeWordIdx}
                        onChange={(e) => setSelectedWordIdx(Number(e.target.value))}
                        style={selectStyle}
                      >
                        {words.map((w, i) => {
                          const label = String(w?.word || w?.text || `Word ${i + 1}`).trim();
                          return (
                            <option key={`${label}_${i}`} value={i}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown className="h-4 w-4" style={chevronStyle} />
                    </div>
                  ) : null}

                  {/* Word (colored like main) */}
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

                  <div style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: LIGHT_MUTED, fontWeight: 800 }}>
                    {currentWordScore == null ? " " : `Score: ${Math.round(currentWordScore)}`
                    }
                  </div>
                 <div style={{ marginTop: 10, textAlign: "center" }}>
  <span
    style={{
      fontSize: 18,        // ✅ større
      fontWeight: 950,
      color: "#111827",    // ✅ tydelig sort
      marginRight: 8,
    }}
  >
    Phonemes:
  </span>

  {(() => {
    const ps = Array.isArray(currentWordObj?.phonemes) ? currentWordObj.phonemes : [];
    const items = [];

    for (const p of ps) {
      const code = getPhonemeCode(p);
      if (!code) continue;
      const s = getScore(p);
      items.push({ code, score: s });
    }

    if (!items.length) {
      return <span style={{ fontSize: 18, fontWeight: 900, color: LIGHT_MUTED }}>—</span>;
    }

    return items.map((it, i) => (
      <span key={`${it.code}_${i}`}>
        <span style={{ fontSize: 18, fontWeight: 950, color: scoreColor(it.score) }}>
          {it.code}
        </span>
        {i < items.length - 1 ? (
          <span style={{ fontSize: 18, fontWeight: 950, color: LIGHT_MUTED }}> · </span>
        ) : null}
      </span>
    ));
  })()}
</div>


<div style={{ marginTop: 14 }}>
                {/* Phoneme cards (only non-green + only if you have image; audio optional) */}
                {phonemeCards.length ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    {phonemeCards.map((p, idx) => (
                      <div
                        key={`${p.code}_${idx}`}
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
                          <div style={{ fontWeight: 950, fontSize: 16, color: LIGHT_TEXT }}>
                            {p.code}
                          </div>
                          <div style={{ fontWeight: 900, fontSize: 12, color: scoreColor(p.score) }}>
                            {p.score == null ? "" : Math.round(p.score)}
                          </div>
                        </div>

                        <div style={{ display: "grid", placeItems: "center" }}>
                          <img
                            src={p.imgSrc}
                            alt={p.code}
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

                        {p.audioSrc ? (
                          <button
                            type="button"
                            onClick={() => playOverlayAudio(p.audioSrc)}
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
                      </div>
                    ))}
                  </div>
                ) : (
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
                    No visual feedback for this word (missing assets or all green).
                  </div>
                  )}
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
