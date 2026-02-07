// src/pages/Coach.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Mic, StopCircle } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useSettings } from "../lib/settings-store.jsx";
import { ingestLocalPhonemeScores } from "../lib/localPhonemeStats.js";

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
  const out = [];
  let guard = 0;

  while (out.length < total && guard < 500) {
    guard++;
    const t = pickRandom(pool);
    if (!t) break;
    if (out[out.length - 1] === t) continue; // avoid immediate repeat
    out.push(t);
  }

  // fallback if pool too small
  while (out.length < total) out.push(pool[0] || "");
  return out;
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

  useEffect(() => {
    setAccentUi(settings?.accentDefault || "en_us");
  }, [settings?.accentDefault]);

  /* ---------------- Daily Drill state machine ---------------- */
  const [phase, setPhase] = useState("setup"); // setup | prompt | recording | analyzing | result | summary
  const [lockedAccent, setLockedAccent] = useState("en_us");

  const [targets, setTargets] = useState([]); // 10 items
  const [idx, setIdx] = useState(0);
  const [attempts, setAttempts] = useState([]); // { i, text, overall, label, createdAt }

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
    const t = setTimeout(() => {
      setIdx((i) => {
        const next = i + 1;
        if (next >= 10) {
          setPhase("summary");
          return i;
        }
        setPhase("prompt");
        cleanupUserUrl();
        return next;
      });
    }, 900);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function onStartDrill() {
    const acc = accentUi === "en_br" ? "en_br" : "en_us";
    setLockedAccent(acc);

    const t = buildTargets({ mode, difficulty, total: 10 });
    setTargets(t);
    setIdx(0);
    setAttempts([]);
    cleanupUserUrl();
    setPhase("prompt");
  }

  function onExit() {
    cleanupUserUrl();
    disposeRecorder();
    setTargets([]);
    setIdx(0);
    setAttempts([]);
    setPhase("setup");
  }

  function onRepeatSameDrill() {
    cleanupUserUrl();
    setIdx(0);
    setAttempts([]);
    setPhase("prompt");
  }

  const summary = useMemo(() => {
    if (!attempts.length) return { avg: 0, great: 0, ok: 0, needs: 0 };
    const sum = attempts.reduce((a, x) => a + (Number.isFinite(x.overall) ? x.overall : 0), 0);
    const avg = Math.round(sum / attempts.length);
    const great = attempts.filter((x) => x.label === "Great").length;
    const ok = attempts.filter((x) => x.label === "OK").length;
    const needs = attempts.filter((x) => x.label === "Needs work").length;
    return { avg, great, ok, needs };
  }, [attempts]);

  /* ---------------- UI helpers ---------------- */
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
    fontSize: 28,
    color: LIGHT_TEXT,
    lineHeight: 1.05,
  };

  const primaryBtn = {
    height: 46,
    padding: "0 18px",
    borderRadius: 16,
    border: "none",
    background: BTN_BLUE,
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    width: 160,
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
      {/* blue backdrop */}
      <div aria-hidden style={{ position: "fixed", inset: 0, background: "#2196F3", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
        {/* header */}
        <div style={{ maxWidth: 520, margin: "0 auto", padding: `calc(${SAFE_TOP} + 18px) 16px 18px`, color: "white" }}>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -0.4 }}>Daily Drill</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9, fontWeight: 700 }}>
            10 quick attempts • instant label • auto-next
          </div>
        </div>

        {/* white sheet */}
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
                {phase === "setup" ? (
                  <motion.div
                    key="setup"
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    style={{ display: "grid", gap: 22 }}
                  >
                    <div style={pickerRow}>
                      <button type="button" onClick={() => setMode((v) => cycleValue(MODE_OPTIONS, v, -1))} style={pickerBtn}>
                        <ChevronLeft className="h-7 w-7" />
                      </button>
                      <div style={pickerCenter}>{MODE_LABEL[mode]}</div>
                      <button type="button" onClick={() => setMode((v) => cycleValue(MODE_OPTIONS, v, 1))} style={pickerBtn}>
                        <ChevronRight className="h-7 w-7" />
                      </button>
                    </div>

                    <div style={pickerRow}>
                      <button
                        type="button"
                        onClick={() => setDifficulty((v) => cycleValue(DIFF_OPTIONS, v, -1))}
                        style={pickerBtn}
                      >
                        <ChevronLeft className="h-7 w-7" />
                      </button>
                      <div style={pickerCenter}>{DIFF_LABEL[difficulty]}</div>
                      <button
                        type="button"
                        onClick={() => setDifficulty((v) => cycleValue(DIFF_OPTIONS, v, 1))}
                        style={pickerBtn}
                      >
                        <ChevronRight className="h-7 w-7" />
                      </button>
                    </div>

                    <div style={pickerRow}>
                      <button
                        type="button"
                        onClick={() => setAccentUi((v) => cycleValue(ACCENT_OPTIONS, v, -1))}
                        style={pickerBtn}
                      >
                        <ChevronLeft className="h-7 w-7" />
                      </button>
                      <div style={pickerCenter}>{ACCENT_LABEL[accentUi]}</div>
                      <button
                        type="button"
                        onClick={() => setAccentUi((v) => cycleValue(ACCENT_OPTIONS, v, 1))}
                        style={pickerBtn}
                      >
                        <ChevronRight className="h-7 w-7" />
                      </button>
                    </div>

                    <div style={{ display: "grid", placeItems: "center", marginTop: 6 }}>
                      <button type="button" onClick={onStartDrill} style={primaryBtn}>
                        Start (10)
                      </button>
                      <div style={{ marginTop: 10, fontSize: 12, color: LIGHT_MUTED, fontWeight: 800, textAlign: "center" }}>
                        Accent locks for the session.
                      </div>
                    </div>
                  </motion.div>
                ) : null}

                {phase !== "setup" ? (
                  <motion.div
                    key="flow"
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    style={{ display: "grid", gap: 16 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={chip("rgba(17,24,39,0.04)")}>
                          {idx + 1}/10
                        </span>
                        <span style={chip("rgba(17,24,39,0.04)")}>
                          {lockedAccent === "en_br" ? "British 🇬🇧" : "American 🇺🇸"}
                        </span>
                      </div>

                      <button type="button" onClick={onExit} style={ghostBtn} disabled={phase === "analyzing"}>
                        Exit
                      </button>
                    </div>

                    {phase === "prompt" || phase === "recording" || phase === "analyzing" ? (
                      <div
                        style={{
                          background: "#fff",
                          border: `1px solid ${LIGHT_BORDER}`,
                          borderRadius: 22,
                          padding: 18,
                          display: "grid",
                          gap: 14,
                        }}
                      >
                        <div style={{ fontSize: 22, fontWeight: 950, color: LIGHT_TEXT, textAlign: "center" }}>
                          {currentText || "—"}
                        </div>

                        <div style={{ display: "grid", placeItems: "center", marginTop: 6 }}>
                          <button
                            type="button"
                            onClick={toggleRecord}
                            disabled={phase === "analyzing" || !currentText}
                            title={phase === "recording" ? "Stop" : "Record"}
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 18,
                              border: "none",
                              background: phase === "recording" ? "#111827" : BTN_BLUE,
                              display: "grid",
                              placeItems: "center",
                              cursor: phase === "analyzing" ? "not-allowed" : "pointer",
                              opacity: phase === "analyzing" ? 0.6 : 1,
                            }}
                          >
                            {phase === "recording" ? (
                              <StopCircle className="h-6 w-6" style={{ color: "white" }} />
                            ) : (
                              <Mic className="h-6 w-6" style={{ color: "white" }} />
                            )}
                          </button>

                          <div style={{ marginTop: 10, minHeight: 18, color: LIGHT_MUTED, fontWeight: 850, fontSize: 12 }}>
                            {phase === "recording" ? "Recording…" : phase === "analyzing" ? "Analyzing…" : " "}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {phase === "result" && lastAttempt ? (
                      <div
                        style={{
                          background: "#fff",
                          border: `1px solid ${LIGHT_BORDER}`,
                          borderRadius: 22,
                          padding: 18,
                          display: "grid",
                          gap: 10,
                          placeItems: "center",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: 44, fontWeight: 1000, letterSpacing: -0.6, color: LIGHT_TEXT }}>
                          {lastAttempt.overall}%
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 950, color: LIGHT_TEXT }}>
                          {lastAttempt.label}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 850, color: LIGHT_MUTED }}>
                          Next…
                        </div>
                      </div>
                    ) : null}

                    {phase === "summary" ? (
                      <div
                        style={{
                          background: "#fff",
                          border: `1px solid ${LIGHT_BORDER}`,
                          borderRadius: 22,
                          padding: 18,
                          display: "grid",
                          gap: 14,
                        }}
                      >
                        <div style={{ fontSize: 20, fontWeight: 1000, color: LIGHT_TEXT }}>Session summary</div>

                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, color: LIGHT_TEXT }}>
                            <span>Average</span>
                            <span>{summary.avg}%</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 850, color: LIGHT_TEXT }}>
                            <span>Great</span>
                            <span>{summary.great}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 850, color: LIGHT_TEXT }}>
                            <span>OK</span>
                            <span>{summary.ok}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 850, color: LIGHT_TEXT }}>
                            <span>Needs work</span>
                            <span>{summary.needs}</span>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 6 }}>
                          <button type="button" onClick={onRepeatSameDrill} style={primaryBtn}>
                            Repeat
                          </button>
                          <button type="button" onClick={onExit} style={ghostBtn}>
                            New drill
                          </button>
                        </div>
                      </div>
                    ) : null}
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
