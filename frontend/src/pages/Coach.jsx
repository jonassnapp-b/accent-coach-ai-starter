// src/pages/Coach.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, StopCircle, ArrowUp, RefreshCw, Sparkles } from "lucide-react";
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

/* ---------------- content pools ---------------- */
const WORDS = {
  easy: [
    "water", "coffee", "world", "future", "music", "people", "focus", "really", "alright", "comfortable",
    "camera", "purple", "problem", "market", "school",
  ],
  medium: [
    "thought", "through", "three", "thirty", "literature", "entrepreneur", "comfortable", "particularly",
    "development", "opportunity", "environment", "performance",
  ],
  hard: [
    "rural", "urbanization", "inequality", "probability", "statistically", "authenticity",
    "responsibility", "interoperability", "characteristically",
  ],
};

const SENTENCES = {
  easy: [
    "I want a coffee, please.",
    "The water is cold today.",
    "I feel alright now.",
    "I like music in the morning.",
  ],
  medium: [
    "I thought it through before I decided.",
    "Three people walked through the door.",
    "I feel comfortable speaking a little slower.",
    "I want to improve my pronunciation step by step.",
  ],
  hard: [
    "Urbanization can change opportunity and inequality over time.",
    "I want a natural rhythm without losing clarity.",
    "This is statistically significant, but the story matters too.",
    "Responsibility and authenticity are hard to balance in practice.",
  ],
};

/* ---------------- small helpers ---------------- */
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pickRandom(arr) {
  const a = Array.isArray(arr) ? arr : [];
  if (!a.length) return "";
  return a[Math.floor(Math.random() * a.length)];
}

function getOverallPctFromApi(json) {
  // Use what the API already returns (simple + stable)
  const v = Number(json?.overall ?? json?.pronunciation ?? json?.overallAccuracy ?? json?.score ?? 0);
  // if it looks like 0..1, scale
  const pct = v <= 1 ? Math.round(clamp(v, 0, 1) * 100) : Math.round(clamp(v, 0, 100));
  return pct;
}

function chooseThreshold(difficulty) {
  // “good enough” thresholds
  if (difficulty === "easy") return 75;
  if (difficulty === "medium") return 82;
  return 88;
}

function choosePraise(overallPct, threshold) {
  if (overallPct >= Math.max(92, threshold + 10)) return "Well done! 🔥";
  if (overallPct >= threshold) return "That’s alright — next one ✅";
  return "Try again — listen once, then repeat 👂";
}

/* ---------------- TTS ---------------- */
function speak(text, { rate = 1.0 } = {}) {
  try {
    if (!("speechSynthesis" in window)) return false;
    const u = new SpeechSynthesisUtterance(String(text || ""));
    u.rate = clamp(Number(rate) || 1.0, 0.5, 1.2);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

export default function Coach() {
  const { settings } = useSettings();

  // UI state
  const [mode, setMode] = useState("word"); // "word" | "sentence"
  const [difficulty, setDifficulty] = useState("easy"); // easy|medium|hard
  const [accentUi, setAccentUi] = useState(settings?.accentDefault || "en_us");

  useEffect(() => {
    setAccentUi(settings?.accentDefault || "en_us");
  }, [settings?.accentDefault]);

  // session state
  const [started, setStarted] = useState(false);
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState("Tap Start to begin.");
  const [streak, setStreak] = useState(0);
  const [levelHint, setLevelHint] = useState("");

  // recording + result
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const [lastUrl, setLastUrl] = useState(null);

  const threshold = useMemo(() => chooseThreshold(difficulty), [difficulty]);

  function pool() {
    if (mode === "sentence") return SENTENCES[difficulty] || [];
    return WORDS[difficulty] || [];
  }

  function nextTarget({ speakIntro = true } = {}) {
    const t = pickRandom(pool());
    setTarget(t);
    setResult(null);
    setErr("");
    setStatus("Say it when you're ready, then record.");
    setLevelHint("");

    if (speakIntro) {
      // iOS-friendly: this should happen right after user gesture (Start/Next button)
      speak(`Try to pronounce: ${t}`, { rate: 0.95 });
    }
  }

  function resetSession() {
    setStarted(false);
    setTarget("");
    setStatus("Tap Start to begin.");
    setStreak(0);
    setLevelHint("");
    setResult(null);
    setErr("");
    try {
      if (lastUrl) URL.revokeObjectURL(lastUrl);
    } catch {}
    setLastUrl(null);
    disposeRecorder();
    setIsRecording(false);
    setIsAnalyzing(false);
  }

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
    setIsAnalyzing(true);
    sendToServer(blob, localUrl);
  }

  async function startRecord() {
    if (!started || !target) return;
    try {
      setErr("");
      await ensureMic();
      chunksRef.current = [];
      mediaRecRef.current.start();
      setIsRecording(true);
      setStatus("Recording…");
    } catch (e) {
      setErr(!IS_PROD ? (e?.message || String(e)) : "Microphone access is blocked. Please allow it and try again.");
      setIsRecording(false);
      setStatus("Tap Record to try again.");
    }
  }

  function stopRecord() {
    try {
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
    } catch {}
  }

  async function toggleRecord() {
    if (isAnalyzing) return;
    if (isRecording) stopRecord();
    else await startRecord();
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

      const overallPct = getOverallPctFromApi(json);
      const ok = overallPct >= threshold;

      const msg = choosePraise(overallPct, threshold);

      const payload = {
        ...json,
        userAudioUrl: localUrl,
        userAudioBlob: audioBlob,
        refText: target,
        accent: accentUi,
        createdAt: Date.now(),
      };

      setResult(payload);

      if (ok) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        setStatus(msg);

        speak(msg, { rate: 1.0 });

        // recommend level up after a small win streak
        if (nextStreak >= 5) {
          if (difficulty === "easy") setLevelHint("You’re on a streak — try Medium difficulty.");
          else if (difficulty === "medium") setLevelHint("Nice — consider switching to Hard difficulty.");
          else setLevelHint("You’re crushing Hard — keep going 🔥");
        }

        // auto-advance after a short delay
        setTimeout(() => {
          // only auto-advance if user didn’t start a new recording
          setResult((cur) => cur); // no-op (keeps latest)
          nextTarget({ speakIntro: true });
        }, 900);
      } else {
        setStreak(0);
        setStatus(msg);
        speak("Try again.", { rate: 1.0 });
      }
    } catch (e) {
      setErr(!IS_PROD ? (e?.message || String(e)) : "Something went wrong. Try again.");
      setStatus("Tap Record to try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  // light-only UI tokens
  const LIGHT_TEXT = "rgba(17,24,39,0.92)";
  const LIGHT_MUTED = "rgba(17,24,39,0.55)";
  const LIGHT_BORDER = "rgba(0,0,0,0.10)";
  const LIGHT_SHADOW = "0 10px 24px rgba(0,0,0,0.06)";
  const LIGHT_SURFACE = "#FFFFFF";
  const LIGHT_PANEL = "#F2F2F7";
  const BLUE = "#2196F3";
  const ORANGE = "#FF9800";

  return (
    <div className="page" style={{ minHeight: "100vh", background: "#fff", color: LIGHT_TEXT }}>
      <div className="mx-auto w-full" style={{ maxWidth: 720, padding: "14px 12px 8px" }}>
        <div style={{ textAlign: "center", fontWeight: 900, fontSize: 18 }}>
          Talk Coach
        </div>
      </div>

      <div className="mx-auto w-full" style={{ maxWidth: 720, padding: "14px 16px 24px" }}>
        {/* Controls */}
        <div
          style={{
            border: `1px solid ${LIGHT_BORDER}`,
            background: LIGHT_SURFACE,
            boxShadow: LIGHT_SHADOW,
            borderRadius: 18,
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {/* Mode */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setMode("word")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: `1px solid ${LIGHT_BORDER}`,
                  background: mode === "word" ? BLUE : LIGHT_PANEL,
                  color: mode === "word" ? "white" : LIGHT_TEXT,
                  fontWeight: 900,
                }}
              >
                Words
              </button>
              <button
                type="button"
                onClick={() => setMode("sentence")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: `1px solid ${LIGHT_BORDER}`,
                  background: mode === "sentence" ? BLUE : LIGHT_PANEL,
                  color: mode === "sentence" ? "white" : LIGHT_TEXT,
                  fontWeight: 900,
                }}
              >
                Sentences
              </button>
            </div>

            {/* Difficulty */}
            <div style={{ display: "flex", gap: 8 }}>
              {["easy", "medium", "hard"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDifficulty(d);
                    setStreak(0);
                    setLevelHint("");
                    if (started) nextTarget({ speakIntro: true });
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: `1px solid ${LIGHT_BORDER}`,
                    background: difficulty === d ? ORANGE : LIGHT_PANEL,
                    color: difficulty === d ? "white" : LIGHT_TEXT,
                    fontWeight: 900,
                    textTransform: "capitalize",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Accent */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <select
                value={accentUi}
                onChange={(e) => setAccentUi(e.target.value)}
                style={{
                  height: 42,
                  borderRadius: 14,
                  padding: "0 12px",
                  fontWeight: 900,
                  color: LIGHT_TEXT,
                  background: LIGHT_PANEL,
                  border: `1px solid ${LIGHT_BORDER}`,
                  outline: "none",
                  cursor: "pointer",
                }}
                title="Accent"
              >
                <option value="en_us">🇺🇸</option>
                <option value="en_br">🇬🇧</option>
              </select>

              <button
                type="button"
                onClick={resetSession}
                title="Reset"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  border: `1px solid ${LIGHT_BORDER}`,
                  background: LIGHT_PANEL,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Status row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900, color: LIGHT_MUTED }}>
              Threshold: <span style={{ color: LIGHT_TEXT }}>{threshold}%</span>
              <span style={{ marginLeft: 10 }}>
                Streak: <span style={{ color: LIGHT_TEXT }}>{streak}</span>
              </span>
            </div>
            {levelHint ? (
              <div style={{ fontWeight: 900, color: ORANGE, display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles className="h-4 w-4" />
                {levelHint}
              </div>
            ) : (
              <div />
            )}
          </div>
        </div>

        {/* Main stage */}
        <div
          style={{
            marginTop: 14,
            borderRadius: 22,
            border: `1px solid ${LIGHT_BORDER}`,
            background: LIGHT_PANEL,
            padding: 16,
            minHeight: 360,
            display: "grid",
            alignContent: "start",
            gap: 12,
          }}
        >
          {!started ? (
            <div style={{ display: "grid", placeItems: "center", height: 320, textAlign: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Ready?</div>
              <div style={{ color: LIGHT_MUTED, fontWeight: 800, maxWidth: 520 }}>
                Tap Start. You’ll get a random {mode === "sentence" ? "sentence" : "word"} and instant feedback.
              </div>

              <button
                type="button"
                onClick={() => {
                  setStarted(true);
                  setStreak(0);
                  nextTarget({ speakIntro: true });
                }}
                style={{
                  marginTop: 6,
                  padding: "12px 16px",
                  borderRadius: 16,
                  border: "none",
                  background: BLUE,
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Start
              </button>
            </div>
          ) : (
            <>
              {/* Target */}
              <div
                style={{
                  background: LIGHT_SURFACE,
                  border: `1px solid ${LIGHT_BORDER}`,
                  borderRadius: 18,
                  padding: "14px 14px",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: LIGHT_MUTED }}>
                    Target
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => speak(`Try to pronounce: ${target}`, { rate: 0.95 })}
                      style={{
                        height: 36,
                        padding: "0 12px",
                        borderRadius: 999,
                        border: `1px solid ${LIGHT_BORDER}`,
                        background: LIGHT_PANEL,
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                      title="Play prompt"
                    >
                      <Volume2 className="h-4 w-4" />
                      Listen
                    </button>

                    <button
                      type="button"
                      onClick={() => nextTarget({ speakIntro: true })}
                      style={{
                        height: 36,
                        padding: "0 12px",
                        borderRadius: 999,
                        border: `1px solid ${LIGHT_BORDER}`,
                        background: LIGHT_PANEL,
                        fontWeight: 900,
                      }}
                      title="Next target"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 10, fontWeight: 950, fontSize: mode === "sentence" ? 26 : 34 }}>
                  {target}
                </div>

                <div style={{ marginTop: 10, color: LIGHT_MUTED, fontWeight: 800, fontSize: 13 }}>
                  {status}
                </div>

                {/* Record button */}
                <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={toggleRecord}
                    disabled={isAnalyzing}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      border: "none",
                      background: isRecording ? ORANGE : "#8B5CF6",
                      display: "grid",
                      placeItems: "center",
                      cursor: isAnalyzing ? "not-allowed" : "pointer",
                      opacity: isAnalyzing ? 0.6 : 1,
                    }}
                    title={isRecording ? "Stop" : "Record"}
                    aria-label={isRecording ? "Stop recording" : "Start recording"}
                  >
                    {isRecording ? (
                      <StopCircle className="h-7 w-7" style={{ color: "white" }} />
                    ) : (
                      <ArrowUp className="h-7 w-7" style={{ color: "white" }} />
                    )}
                  </button>
                </div>

                <div style={{ marginTop: 8, textAlign: "center", color: LIGHT_MUTED, fontWeight: 800, fontSize: 12 }}>
                  {isRecording ? "Recording…" : isAnalyzing ? "Analyzing…" : " "}
                </div>

                {err ? (
                  <div style={{ marginTop: 10, textAlign: "center", color: "#e5484d", fontWeight: 900, fontSize: 13 }}>
                    {err}
                  </div>
                ) : null}
              </div>

              {/* Feedback */}
              {result ? (
                <div style={{ background: "transparent" }}>
                  <div className="pf-embed-wrap" style={{ width: "100%", minWidth: 0 }}>
                    <div className="pf-embed-inner">
                      <PhonemeFeedback result={result} embed={true} hideBookmark={true} />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 18,
                    border: `1px solid ${LIGHT_BORDER}`,
                    background: "rgba(255,255,255,0.65)",
                    padding: 14,
                    color: LIGHT_MUTED,
                    fontWeight: 800,
                    textAlign: "center",
                  }}
                >
                  Record to get instant visual feedback.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
