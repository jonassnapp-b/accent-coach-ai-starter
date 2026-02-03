// src/pages/AiChat.jsx
import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, StopCircle, X, ChevronRight, Volume2 } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import { AI_CHAT_LEVELS } from "../data/aiChatScenarios.js";

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

/**
 * Placeholder: 10 levels, each with X scenarios.
 * Progress "0/13" is stored per scenario so it can be real later.
 */


function lsKeyProgress(scenarioId) {
  return `ai_chat_progress_v1:${scenarioId}`;
}

function readProgress(scenarioId) {
  try {
    const raw = localStorage.getItem(lsKeyProgress(scenarioId));
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
}

function writeProgress(scenarioId, n) {
  try {
    localStorage.setItem(lsKeyProgress(scenarioId), String(Math.max(0, Math.floor(n))));
  } catch {}
}

export default function AiChat() {
  const { settings } = useSettings();
  const accentUi = settings?.accentDefault || "en_us";

  // light tokens (match your Coach light UI)
  const LIGHT_TEXT = "rgba(17,24,39,0.92)";
  const LIGHT_MUTED = "rgba(17,24,39,0.55)";
  const LIGHT_BORDER = "rgba(255,255,255,0.10)";
  const CARD = "rgba(255,255,255,0.06)";
  const CARD2 = "rgba(255,255,255,0.08)";

  // selected scenario modal
  const [activeScenario, setActiveScenario] = useState(null);
  const levels = useMemo(() => AI_CHAT_LEVELS, []);

  
  return (
    <div
      style={{
        minHeight: "100vh",
        color: "white",
        background: "radial-gradient(1200px 800px at 20% 0%, rgba(99,102,241,0.45), transparent 55%), radial-gradient(900px 600px at 80% 10%, rgba(236,72,153,0.35), transparent 55%), #070A12",
        paddingBottom: 88,
      }}
    >
      {/* Header */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 14px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div />


          <button
            type="button"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.85)",
              display: "grid",
              placeItems: "center",
              fontSize: 18,
            }}
            title="History"
          >
            ⏱
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 14px" }}>
        {levels.map((lvl) => (
          <div key={`lvl_${lvl.level}`} style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 40, fontWeight: 950, letterSpacing: -0.6 }}>Level {lvl.level}</div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              {lvl.scenarios.map((s, idx) => {
                const done = readProgress(s.id);
                                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveScenario({ ...s, level: lvl.level })}
                    style={{
                      border: "none",
                      textAlign: "left",
                      cursor: "pointer",
                      background: "transparent",
                      padding: 0,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      {/* left node */}
                      <div style={{ position: "relative", width: 84, height: 84, flex: "0 0 auto" }}>
                        <div
                          style={{
                            width: 84,
                            height: 84,
                            borderRadius: 999,
                            background:
                              idx % 2 === 0
                                ? "radial-gradient(circle at 30% 30%, rgba(99,102,241,0.9), rgba(236,72,153,0.45) 55%, rgba(255,255,255,0.06) 75%)"
                                : "radial-gradient(circle at 30% 30%, rgba(34,197,94,0.65), rgba(99,102,241,0.35) 55%, rgba(255,255,255,0.06) 75%)",
                           border: "2px solid rgba(255,255,255,0.16)",
boxShadow: "0 16px 40px rgba(0,0,0,0.28)",

                            display: "grid",
                            placeItems: "center",
                           color: "rgba(255,255,255,0.92)",
fontSize: 30,

                          }}
                        >
                          {s.emoji}
                        </div>

                       
                      </div>

                      {/* right text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 950, color: "rgba(255,255,255,0.82)" }}>
                          {s.title}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.50)" }}>
                          {s.subtitle}
                        </div>
                      </div>

                      {/* progress */}
                      <div style={{ flex: "0 0 auto", color: "rgba(255,255,255,0.55)", fontWeight: 900 }}>
                        {done}/{s.total}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Scenario modal (chat screen) */}
      <AnimatePresence>
        {activeScenario ? (
          <ScenarioChatModal
            key={activeScenario.id}
            scenario={activeScenario}
            accentUi={accentUi}
            onClose={() => setActiveScenario(null)}
            readProgress={() => readProgress(activeScenario.id)}
            writeProgress={(n) => writeProgress(activeScenario.id, n)}
            theme={{ LIGHT_TEXT, LIGHT_MUTED, LIGHT_BORDER, CARD, CARD2 }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ScenarioChatModal({ scenario, accentUi, onClose, readProgress, writeProgress, theme }) {
  const { settings } = useSettings();

const [messages, setMessages] = useState(() => [
  {
    role: "assistant",
    speaker: scenario.partnerName || "AI Partner",
    text: scenario.opening || "Hi! Ready to start?",
  },
]);


  // AI returns an "expected short reply" that you score against
  const [targetLine, setTargetLine] = useState(() => scenario.firstUserLine || "");
function speakTarget() {
  try {
    const txt = String(targetLine || "").trim();
    if (!txt) return;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = accentUi === "en_br" ? "en-GB" : "en-US";
      window.speechSynthesis.speak(u);
    }
  } catch {}
}

// Word-level coloring from SpeechSuper words[] (best-effort)
function buildWordScoreMap(wordsArr) {
  const m = new Map();
  const ws = Array.isArray(wordsArr) ? wordsArr : [];
  for (const w of ws) {
    const rawWord = String(w?.word || "").trim();
    if (!rawWord) continue;

    const sc = Number(w?.accuracyScore ?? w?.overallAccuracy ?? w?.score ?? w?.accuracy ?? NaN);
    if (!Number.isFinite(sc)) continue;

    const pct = sc <= 1 ? Math.round(sc * 100) : Math.round(sc);
    // keep the worst score if duplicated
    const key = rawWord.toLowerCase();
    const prev = m.get(key);
    if (prev == null || pct < prev) m.set(key, pct);
  }
  return m;
}

// Split text into tokens while preserving spaces/punctuation
function tokenizeWithSeparators(text) {
  return String(text || "").match(/(\s+|[^\s]+)/g) || [];
}

function colorForPct(pct) {
  // Tune thresholds to match your look
  if (pct >= 85) return "rgba(34,197,94,0.95)";   // green
  if (pct >= 70) return "rgba(245,158,11,0.95)";  // orange
  return "rgba(239,68,68,0.95)";                  // red
}

function renderScoredLine(text, wordScoreMap) {
  const tokens = tokenizeWithSeparators(text);
  return tokens.map((tok, i) => {
    // keep whitespace as-is
    if (/^\s+$/.test(tok)) return <span key={`t_${i}`}>{tok}</span>;

    // strip punctuation for lookup, but keep original token
    const cleaned = tok.replace(/^[^\w']+|[^\w']+$/g, "");
    const pct = cleaned ? wordScoreMap.get(cleaned.toLowerCase()) : null;

    const style = pct == null ? { color: "rgba(255,255,255,0.92)" } : { color: colorForPct(pct) };
    return (
      <span key={`t_${i}`} style={style}>
        {tok}
      </span>
    );
  });
}


  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const micStreamRef = useRef(null);

  const [lastScorePct, setLastScorePct] = useState(null);
  const [improveWord, setImproveWord] = useState({ word: "sales", pct: 76 });

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

  function stopAll() {
    try { mediaRecRef.current?.stop?.(); } catch {}
    try { micStreamRef.current?.getTracks?.()?.forEach((t) => t.stop()); } catch {}
    micStreamRef.current = null;
    mediaRecRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setIsAnalyzing(false);
  }

  async function startRecording() {
    if (isAnalyzing) return;
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
    else await startRecording();
  }

  async function handleStop(rec) {
    setIsRecording(false);
    const chunks = chunksRef.current.slice();
    chunksRef.current = [];

    const type = chunks[0]?.type || rec?.mimeType || "audio/webm";
    const blob = new Blob(chunks, { type });

    setIsAnalyzing(true);
    try {
      // 1) score pronunciation via SpeechSuper (same endpoint as Coach/Record)
      const base = getApiBase();
      const fd = new FormData();
      fd.append("audio", blob, "clip.webm");

      // IMPORTANT: we score against AI’s "expected short reply"
      fd.append("refText", targetLine);

      fd.append("accent", accentUi === "en_br" ? "en_br" : "en_us");

      const r = await fetch(`${base}/api/analyze-speech`, { method: "POST", body: fd });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json?.error || r.statusText || "Analyze failed");

      // overall score (best-effort extraction)
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
      setLastScorePct(Math.round(overall));

      // 2) show "You can improve <word> <pct>" like screenshot (placeholder extraction)
      // If SpeechSuper words exist, pick lowest word score, else keep placeholder.
      try {
        const ws = Array.isArray(json?.words) ? json.words : [];
        let worst = null;

        for (const w of ws) {
          const wtxt = String(w?.word || "").trim();
          const sc = Number(w?.accuracyScore ?? w?.overallAccuracy ?? w?.score ?? w?.accuracy ?? NaN);
          const pct = Number.isFinite(sc) ? (sc <= 1 ? Math.round(sc * 100) : Math.round(sc)) : null;
          if (!wtxt || pct == null) continue;
          if (!worst || pct < worst.pct) worst = { word: wtxt, pct };
        }
        if (worst) setImproveWord(worst);
      } catch {}
const wordScoreMap = buildWordScoreMap(json?.words);

      // 3) Append the user message (we show the expected reply text as what user intended to say)
      const userText = targetLine;

  setMessages((prev) => [
  ...prev,
  {
    role: "user",
    speaker: "You",
    text: userText,
    score: Math.round(overall),
    wordScores: Array.from(wordScoreMap.entries()), // serializeable
  },
]);

      // 4) Get real AI partner reply + next expected reply
      const ai = await fetch(`${base}/api/ai-chat-turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          scenarioSubtitle: scenario.subtitle,
          level: scenario.level,
          accent: accentUi,
          history: [...messages, { role: "user", text: userText }],
        }),
      }).then((x) => x.json().catch(() => null));

      if (ai?.assistantText) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", speaker: scenario.partnerName || "AI Partner", text: ai.assistantText },
        ]);
      }

  if (ai?.nextUserLine) {
  setTargetLine(String(ai.nextUserLine).trim() || "");
}


      // progress +1 (real counter)
      const next = Math.min((readProgress() || 0) + 1, scenario.total || 999);
      writeProgress(next);
    } catch (e) {
      // if you want: show error as system message
      setMessages((prev) => [...prev, { role: "system", speaker: "System", text: String(e?.message || e) }]);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const { LIGHT_TEXT, LIGHT_MUTED, LIGHT_BORDER, CARD, CARD2 } = theme;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 14, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background:
          "radial-gradient(1200px 800px at 20% 0%, rgba(99,102,241,0.45), transparent 55%), radial-gradient(900px 600px at 80% 10%, rgba(236,72,153,0.35), transparent 55%), #070A12",
        padding: 12,
        paddingBottom: 24,
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          height: "100%",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          gap: 10,
        }}
      >
        {/* Modal header */}
        <div
          style={{
            borderRadius: 24,
            padding: 14,
            border: `1px solid rgba(255,255,255,0.10)`,
            background: "rgba(255,255,255,0.06)",
            boxShadow: "0 22px 60px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                🙂
              </div>
              <div>
                <div style={{ fontWeight: 950, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>{scenario.partnerName} — {scenario.partnerTitle}</div>
                <div style={{ fontWeight: 900, fontSize: 12, color: "rgba(255,255,255,0.50)" }}>{scenario.title}</div>
              </div>
            </div>

            <button
              type="button"
            onClick={() => {
  try { window?.speechSynthesis?.cancel?.(); } catch {}
  stopAll();
  onClose();
}}

              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.85)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ overflowY: "auto", padding: "6px 4px" }}>
          <div style={{ display: "grid", gap: 14 }}>
            {messages.map((m, idx) => {
              if (m.role === "assistant") {
                return (
                  <div key={`m_${idx}`} style={{ display: "grid", gap: 8 }}>
                    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.40)", fontWeight: 900, fontSize: 12 }}>
                      {m.speaker}
                    </div>
                    <div
                      style={{
                        margin: "0 auto",
                        width: "min(520px, 92%)",
                        background: "rgba(59,130,246,0.85)",
                        borderRadius: 24,
                        padding: "16px 18px",
                        fontWeight: 950,
                        fontSize: 34,
                        lineHeight: 1.05,
                        boxShadow: "0 22px 60px rgba(0,0,0,0.35)",
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              }

              if (m.role === "user") {
                return (
                  <div key={`m_${idx}`} style={{ display: "grid", gap: 10 }}>
                    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontWeight: 900, fontSize: 12 }}>
                      You
                    </div>

                    <div
                      style={{
                        margin: "0 auto",
                        width: "min(520px, 92%)",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 22,
                        padding: "14px 16px",
                        position: "relative",
                        boxShadow: "0 22px 60px rgba(0,0,0,0.35)",
                      }}
                    >
                      <div style={{ fontWeight: 950, fontSize: 28, lineHeight: 1.06 }}>
                        {m.wordScores ? (
  renderScoredLine(
    m.text,
    new Map(m.wordScores) // rebuild Map
  )
) : (
  <span style={{ color: "rgba(34,197,94,0.95)" }}>{m.text}</span>
)}
                      </div>

                      {Number.isFinite(m.score) ? (
                        <div
                          style={{
                            position: "absolute",
                            right: 10,
                            top: 10,
                            background: "rgba(34,197,94,0.95)",
                            color: "#04110A",
                            fontWeight: 950,
                            borderRadius: 10,
                            padding: "6px 10px",
                            fontSize: 14,
                          }}
                        >
                          {Math.round(m.score)}%
                        </div>
                      ) : null}
                    </div>

                    {/* Improve bar like screenshot */}
                    <div
                      style={{
                        margin: "0 auto",
                        width: "min(520px, 92%)",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 18,
                        padding: "12px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.10)",
                          }}
                        />
                        <div style={{ fontWeight: 900, color: "rgba(255,255,255,0.85)" }}>You can improve</div>
                      </div>

                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          background: "rgba(255,255,255,0.10)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 999,
                          padding: "8px 12px",
                          fontWeight: 950,
                        }}
                      >
                        <span style={{ color: "rgba(255,255,255,0.85)" }}>{improveWord.word}</span>
                        <span style={{ color: "rgba(245,158,11,0.95)" }}>{improveWord.pct}%</span>
                        <ChevronRight className="h-4 w-4" style={{ color: "rgba(255,255,255,0.65)" }} />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={`m_${idx}`} style={{ textAlign: "center", color: "rgba(255,255,255,0.50)", fontWeight: 900 }}>
                  {m.text}
                </div>
              );
            })}
            {targetLine ? (
  <div key="target_line" style={{ display: "grid", gap: 10 }}>
    <div
      style={{
        textAlign: "center",
        color: "rgba(255,255,255,0.35)",
        fontWeight: 900,
        fontSize: 12,
      }}
    >
      You
    </div>

    {/* Right-shifted “your turn” bubble */}
   <div
  style={{
    width: "min(560px, 88%)",     // lidt bredere, men mindre % så den ikke ryger ud
    maxWidth: "100%",
    boxSizing: "border-box",

    marginLeft: "auto",
    marginRight: 0,
    transform: "translateX(22px)",

    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,

    padding: "12px 16px 14px",
    paddingRight: 72,            // IMPORTANT: plads til speaker-knappen

    position: "relative",
    boxShadow: "0 22px 60px rgba(0,0,0,0.35)",
  }}
>

      <div
        style={{
          fontWeight: 950,
          fontSize: 12,
          letterSpacing: 0.2,
          color: "rgba(255,255,255,0.55)",
          marginBottom: 8,
        }}
      >
        Your turn — say this out loud
      </div>

      <div style={{ fontWeight: 950, fontSize: 28, lineHeight: 1.06 }}>
        <span style={{ color: "rgba(255,255,255,0.92)" }}>{targetLine}</span>
      </div>

      <div
        style={{
          marginTop: 8,
          fontWeight: 900,
          fontSize: 12,
          color: "rgba(255,255,255,0.40)",
        }}
      >
        Tap the speaker, then record it
      </div>

      <button
        type="button"
        onClick={speakTarget}
        style={{
          position: "absolute",
          right: 14,
top: 14,

          width: 40,
          height: 40,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.9)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
        }}
        title="Play"
      >
        <Volume2 className="h-5 w-5" />
      </button>
    </div>
  </div>
) : null}


          </div>
        </div>



        {/* Mic */}
        <div style={{ display: "grid", placeItems: "center", paddingBottom: 6 }}>
          <button
            type="button"
            onClick={toggleRecord}
            disabled={isAnalyzing}
            style={{
              width: 92,
              height: 92,
              borderRadius: 999,
              border: "none",
              background: "radial-gradient(circle at 30% 30%, rgba(244,63,94,0.95), rgba(99,102,241,0.80))",
              boxShadow: "0 26px 70px rgba(0,0,0,0.45)",
              display: "grid",
              placeItems: "center",
              cursor: isAnalyzing ? "not-allowed" : "pointer",
              opacity: isAnalyzing ? 0.65 : 1,
            }}
            title={isRecording ? "Stop" : "Record"}
          >
            {isRecording ? <StopCircle className="h-10 w-10" style={{ color: "white" }} /> : <Mic className="h-10 w-10" style={{ color: "white" }} />}
          </button>

          <div style={{ marginTop: 10, fontWeight: 900, color: "rgba(255,255,255,0.55)" }}>
            {isRecording ? "Recording…" : isAnalyzing ? "Analyzing…" : " "}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
