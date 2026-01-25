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

  // light tokens (match your Record page vibe)
  const LIGHT_TEXT = "rgba(17,24,39,0.92)";
  const LIGHT_MUTED = "rgba(17,24,39,0.55)";
  const LIGHT_BORDER = "rgba(0,0,0,0.10)";
  const LIGHT_SHADOW = "0 10px 24px rgba(0,0,0,0.06)";
  const LIGHT_SURFACE = "#FFFFFF";
  const LIGHT_BG = "#EEF5FF";
  const BTN_BLUE = "#2196F3";

  const TABBAR_OFFSET = 64;

  // ✅ dropdown state (like accent)
  const [mode, setMode] = useState("words"); // words | sentences
  const [difficulty, setDifficulty] = useState("easy"); // easy | medium | hard
  const [accentUi, setAccentUi] = useState(settings?.accentDefault || "en_us");

  useEffect(() => {
    setAccentUi(settings?.accentDefault || "en_us");
  }, [settings?.accentDefault]);

  // ✅ stage: ONLY big card with 3 dropdowns first, then transition into the flow
  const [stage, setStage] = useState("setup"); // setup | flow

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
  const userAudioRef = useRef(null);

  // used to auto-transition after dropdown changes
  const startTimerRef = useRef(null);

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

  function speakTts(text) {
    try {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.0;
      u.pitch = 1.0;
      u.volume = settings?.soundEnabled === false ? 0 : 1;

      window.speechSynthesis.speak(u);
    } catch {}
  }

  function buildNewTarget(nextMode = mode, nextDiff = difficulty) {
    const pool = nextMode === "sentences" ? (SENTENCES[nextDiff] || []) : (WORDS[nextDiff] || []);
    return pickRandom(pool);
  }

  function nextInstruction(t, nextMode = mode) {
    if (nextMode === "sentences") return `Try to say: ${t}`;
    return `Try to pronounce: ${t}`;
  }

  function beginFlow() {
    const t = buildNewTarget(mode, difficulty);
    setTarget(t);
    setResult(null);
    setStatus("");
    speakTts(nextInstruction(t, mode));
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
        speakTts("Well done. Let's go to the next one.");
        const next = buildNewTarget(mode, difficulty);
        setTarget(next);
        setTimeout(() => speakTts(nextInstruction(next, mode)), 250);
      } else if (overall >= threshold) {
        setStatus("That’s alright — next 👌");
        speakTts("That's alright. Let's go to the next one.");
        const next = buildNewTarget(mode, difficulty);
        setTarget(next);
        setTimeout(() => speakTts(nextInstruction(next, mode)), 250);
      } else {
        setStatus("Try again (listen to the feedback) 🔁");
        speakTts("Try again.");
      }
    } catch (e) {
      setStatus(IS_PROD ? "Something went wrong. Try again." : e?.message || String(e));
    } finally {
      setIsAnalyzing(false);
    }
  }

  // ✅ Auto-transition: when user touches any dropdown in setup, go to flow (no Start button)
  function scheduleAutoStart() {
    if (stage !== "setup") return;
    if (startTimerRef.current) clearTimeout(startTimerRef.current);

    // tiny delay so UI feels intentional (and gives a clean transition)
    startTimerRef.current = setTimeout(() => {
      setStage("flow");
    }, 180);
  }

  useEffect(() => {
    if (stage !== "flow") return;
    // when we enter flow, start it immediately
    beginFlow();

    return () => {
      // cleanup any timer
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // If user changes settings while still on setup, we just schedule the start.
  // If user somehow changes state after flow (shouldn't happen because controls aren't shown),
  // we don't auto-regenerate here.
  useEffect(() => {
    if (stage !== "setup") return;
    scheduleAutoStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, difficulty, accentUi]);

  // ✅ ONE big card layout: 3 dropdowns in one row, never “2 lines”.
  // If viewport too narrow, row scrolls horizontally instead of wrapping.
  const bigCardStyle = {
    background: LIGHT_SURFACE,
    border: `1px solid ${LIGHT_BORDER}`,
    borderRadius: 22,
    boxShadow: LIGHT_SHADOW,
    padding: 14,
    width: "100%",
    maxWidth: 520,
    margin: "0 auto",
  };

  const rowNoWrap = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "nowrap",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    paddingBottom: 2,
  };

  const selectWrapStyle = {
    position: "relative",
    flex: "0 0 auto",
  };

  const selectStyle = {
    height: 44,
    borderRadius: 16,
    padding: "0 12px",
    fontWeight: 900,
    color: LIGHT_TEXT,
    background: LIGHT_SURFACE,
    border: `1px solid ${LIGHT_BORDER}`,
    outline: "none",
    cursor: "pointer",
    appearance: "none",
    paddingRight: 34,
  };

  const chevronStyle = {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    color: LIGHT_MUTED,
    pointerEvents: "none",
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
              <div style={rowNoWrap}>
                {/* Mode */}
                <div style={selectWrapStyle}>
                  <select
                    aria-label="Mode"
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value);
                      scheduleAutoStart();
                    }}
                    style={selectStyle}
                    title="Mode"
                  >
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
                    onChange={(e) => {
                      setDifficulty(e.target.value);
                      scheduleAutoStart();
                    }}
                    style={selectStyle}
                    title="Difficulty"
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
                    onChange={(e) => {
                      setAccentUi(e.target.value);
                      scheduleAutoStart();
                    }}
                    style={selectStyle}
                    title="Accent"
                  >
                    <option value="en_us">🇺🇸</option>
                    <option value="en_br">🇬🇧</option>
                  </select>
                  <ChevronDown className="h-4 w-4" style={chevronStyle} />
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
              {/* Prompt */}
              <div style={{ textAlign: "center", fontWeight: 900, fontSize: 22 }}>{target || "—"}</div>

              {/* Record button */}
              <div style={{ display: "grid", placeItems: "center", marginTop: 14 }}>
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
                  <div className="pf-embed-wrap" style={{ width: "100%", minWidth: 0 }}>
                    <div className="pf-embed-inner">
                      <PhonemeFeedback result={result} embed={true} hideBookmark={true} />
                    </div>
                  </div>
                </div>
              ) : null}

              <audio ref={userAudioRef} playsInline preload="auto" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
