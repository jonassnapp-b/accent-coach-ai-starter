// src/pages/Coach.jsx
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Mic, StopCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "../lib/settings-store.jsx";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";

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

useEffect(() => {
  // ✅ reset prewarm when accent changes (so voice can change)
  if (prewarmUrlRef.current) {
    try { URL.revokeObjectURL(prewarmUrlRef.current); } catch {}
    prewarmUrlRef.current = null;
    setPrewarmReady(false);
  }

  // ✅ warm up again for the new accent
  prewarmRepeat();

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

// pop effect while the target is spoken
const [isSpeakingTarget, setIsSpeakingTarget] = useState(false);



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
  // 1) invalidate any pending async that would continue
  ttsPlayIdRef.current += 1;

  // 2) abort in-flight fetch
  try {
    ttsAbortRef.current?.abort?.();
  } catch {}
  ttsAbortRef.current = null;

  // 3) stop audio immediately
  try {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      ttsAudioRef.current.src = "";
      ttsAudioRef.current.load?.();
    }
  } catch {}

  // 4) revoke blob url
  try {
    if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current);
  } catch {}
  ttsUrlRef.current = null;

  setIsSpeaking(false);
  setIsSpeakingTarget(false);
}

  async function playTts(text, rate = 1.0) {
  const t = String(text || "").trim();
  if (!t) return;

  // stop previous
  try {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
    }
  } catch {}

  // revoke old url
  try {
    if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current);
  } catch {}
  ttsUrlRef.current = null;

const base = getApiBase();
const myId = ++ttsPlayIdRef.current;

try {
  ttsAbortRef.current?.abort?.();
} catch {}
const controller = new AbortController();
ttsAbortRef.current = controller;

let r;
try {
  r = await fetch(`${base}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: t,
      accent: accentUi, // en_us or en_br
      rate,
    }),
    signal: controller.signal, // ✅ rigtigt sted
  });
} catch (e) {
  if (e?.name === "AbortError") return; // ✅ back clicked -> ignore
  throw e;
}

if (myId !== ttsPlayIdRef.current) return;

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



  const blob = new Blob([buf], { type: "audio/wav" }); // your endpoint returns wav
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

  // hvis du vil kunne abort'e den her også, kan du gemme controller i en ref,
  // men jeg holder det MINIMALT her (du har allerede stopTtsNow til playTts flow)

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

  // stop previous
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
  // allerede cached
if (prewarmUrlRef.current) return;



  try {
    const base = getApiBase();

    // fetch repeat audio én gang
    const r = await fetch(`${base}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Repeat after me.",
        accent: accentUi, // bruger valgt accent
        rate: 1.0,
      }),
    });

    if (!r.ok) return;

    const buf = await r.arrayBuffer();
    const blob = new Blob([buf], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);

    prewarmUrlRef.current = url;
    setPrewarmReady(true);
  } catch {
    // ignore – app skal stadig virke uden
  }
}


// ✅ “Repeat after me.” + pause + target pop while spoken
async function speakSequence(t) {


  // pause before the target
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
    


  // ✅ start target fetch NU (imens repeat spiller)
  const targetUrlPromise = fetchTtsUrl(t, 0.98);

  // 1) intro: “Repeat after me.”
  setIsSpeaking(true);
  try {
    if (prewarmUrlRef.current) {
      await playPrewarmedUrl(prewarmUrlRef.current);
    } else {
      await playTts("Repeat after me.", 1.0);
    }
  } catch (e) {
    if (!IS_PROD) console.warn("[TTS intro]", e);
  } finally {
    setIsSpeaking(false);
  }

  // 2) transition til flow NU
  setStage("flow");

  // 3) sig target så snart repeat er færdig (uden ekstra sleep)
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

  setStage("intro");

  if (!prewarmUrlRef.current) {
  await prewarmRepeat();
}


  // Kør TTS med det samme (stadig i click event)
  await beginIntroThenFlow();
}


  function onBack() {
    if (isBusy) return;
    stopTtsNow();

    // stop any TTS audio
try {
  if (ttsAudioRef.current) {
    ttsAudioRef.current.pause();
    ttsAudioRef.current.currentTime = 0;
  }
} catch {}
try {
  if (ttsUrlRef.current) URL.revokeObjectURL(ttsUrlRef.current);
} catch {}
ttsUrlRef.current = null;
try {
  if (prewarmUrlRef.current) {
    URL.revokeObjectURL(prewarmUrlRef.current);
  }
} catch {}
prewarmUrlRef.current = null;
setPrewarmReady(false);

setIsSpeaking(false);
setIsSpeakingTarget(false);

    // cleanup recording + audio url
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

      const overall = Number(json?.overall ?? json?.overallAccuracy ?? json?.pronunciation ?? 0);
      const threshold = difficulty === "easy" ? 75 : difficulty === "medium" ? 82 : 88;

      if (overall >= threshold + 7) {
        setStatus("Well done ✅");
        await playTts("Well done. Let's go to the next one.");
        const next = buildNewTarget(mode, difficulty);
        setTarget(next);
        

        await speakSequence(next)
      } else if (overall >= threshold) {
        setStatus("That’s alright — next 👌");
        await playTts("That's alright. Let's go to the next one.");
        const next = buildNewTarget(mode, difficulty);
        setTarget(next);
        

        await speakSequence(next)
      } else {
        setStatus("Try again (listen to the feedback) 🔁");
        await playTts("Try again.");
      }
    } catch (e) {
      setStatus(IS_PROD ? "Something went wrong. Try again." : e?.message || String(e));
    } finally {
      setIsAnalyzing(false);
    }
  }

  // layout: one big setup card, dropdowns stacked with good vertical spacing
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
                {/* Mode */}
                <div style={selectWrapStyle}>
                  <select aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value)} style={selectStyle}>
                    <option value="words">Words</option>
                    <option value="sentences">Sentences</option>
                  </select>
                  <ChevronDown className="h-4 w-4" style={chevronStyle} />
                </div>

                {/* Difficulty */}
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

                {/* Accent */}
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
          ) : stage === "intro" ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              style={speakingCardStyle}
            >
              <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                {/* simple “AI person” bubble */}
                <div
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 999,
                    background: "#ffffff",
                    border: `1px solid ${LIGHT_BORDER}`,
                    boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    color: LIGHT_TEXT,
                  }}
                >
                  AI
                </div>

                <div style={{ fontWeight: 900, color: LIGHT_TEXT }}>
                  Coach is speaking{isSpeaking ? "…" : ""}
                </div>

                {/* tiny waveform */}
                <div style={{ display: "flex", gap: 6, alignItems: "end", height: 18 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 6, opacity: 0.6 }}
                      animate={{ height: isSpeaking ? [6, 16, 8, 14, 6] : 6, opacity: 0.9 }}
                      transition={{
                        duration: isSpeaking ? 0.9 : 0.2,
                        repeat: isSpeaking ? Infinity : 0,
                        delay: i * 0.06,
                      }}
                      style={{
                        width: 6,
                        borderRadius: 999,
                        background: BTN_BLUE,
                      }}
                    />
                  ))}
                </div>
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
              {/* Back */}
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

              {/* Speaking mini indicator */}
              {isSpeaking ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: `1px solid ${LIGHT_BORDER}`,
                      background: "#fff",
                      boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
                      fontWeight: 900,
                      color: LIGHT_TEXT,
                      fontSize: 12,
                    }}
                  >
                    Coach is speaking…
                  </div>
                </div>
              ) : null}

              {/* Prompt */}
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

              {/* Record button */}
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

              {/* Feedback */}
              {result ? (
  <div style={{ marginTop: 12 }}>
    <PhonemeFeedback
      result={result}
      embed={true}
      hideBookmark={true}
      mode="mainOnly"
     
    />

   
  </div>
) : null}

                          </motion.div>
          )}
        </AnimatePresence>
        <audio ref={ttsAudioRef} playsInline preload="auto" />

      </div>
    </div>
  );
}
