// src/pages/AiChat.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

  // cleaner, solid icon circle colors
  const ICON_CIRCLE_COLORS = [
    "#FF6B6B", // red
    "#FFB703", // amber
    "#34D399", // green
    "#60A5FA", // blue
    "#A78BFA", // purple
    "#F472B6", // pink
    "#22C55E", // vivid green
    "#38BDF8", // cyan
  ];


  // selected scenario modal
  const [activeScenario, setActiveScenario] = useState(null);
  const levels = useMemo(() => AI_CHAT_LEVELS, []);
useEffect(() => {
  const prevHtml = document.documentElement.style.overflow;
  const prevBody = document.body.style.overflow;

  if (activeScenario) {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  } else {
    document.documentElement.style.overflow = prevHtml || "";
    document.body.style.overflow = prevBody || "";
  }

  return () => {
    document.documentElement.style.overflow = prevHtml || "";
    document.body.style.overflow = prevBody || "";
  };
}, [activeScenario]);

  
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
      }}
    >
      {/* Force blue backdrop even if parent/shell paints background */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: "#2196F3",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="mx-auto max-w-[720px]" style={{ width: "100%" }}>
          {/* Blue header */}
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              padding: "18px 16px 18px",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -0.4 }}>
              AI Chat
            </div>

          

          </div>

          {/* White sheet */}
          <div
            style={{
              flex: 1,
              background: "#FFFFFF",
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              boxShadow: "0 -1px 0 rgba(255,255,255,0.10), 0 18px 40px rgba(0,0,0,0.10)",
              padding: "24px 16px 16px",
              paddingBottom: "calc(16px + var(--safe-bottom))",
            }}
          >
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
              {levels.map((lvl) => {
                const completedInLevel = lvl.scenarios.filter((s) => readProgress(s.id) >= s.total).length;
                const totalInLevel = lvl.scenarios.length;

                return (
                  <div key={`lvl_${lvl.level}`} style={{ marginTop: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 40, fontWeight: 950, letterSpacing: -0.6, color: "rgba(17,24,39,0.92)" }}>
                        Level {lvl.level}
                      </div>

                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 900,
                          color: "rgba(17,24,39,0.55)",
                        }}
                      >
                        {completedInLevel}/{totalInLevel}
                      </div>
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
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                padding: "10px 12px",
                                borderRadius: 18,
                                border: "1px solid rgba(17,24,39,0.10)",
                                background: "#FFFFFF",
                              }}
                            >
                              {/* left node */}
                              <div style={{ position: "relative", width: 84, height: 84, flex: "0 0 auto" }}>
                                <div
                                  style={{
                                    width: 84,
                                    height: 84,
                                    borderRadius: 999,
                                                                       background: (() => {
                                      const base = ICON_CIRCLE_COLORS[idx % ICON_CIRCLE_COLORS.length];
                                      return `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.55), rgba(255,255,255,0) 58%), ${base}`;
                                    })(),
                                    border: "2px solid rgba(0,0,0,0.06)",
                                    boxShadow: "0 16px 40px rgba(0,0,0,0.14)",
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
                                <div style={{ fontSize: 22, fontWeight: 950, color: "rgba(17,24,39,0.92)" }}>
                                  {s.title}
                                </div>
                                <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: "rgba(17,24,39,0.55)" }}>
                                  {s.subtitle}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
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
      </div>
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
const [turnIndex, setTurnIndex] = useState(0);


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
  const [analyzeStatus, setAnalyzeStatus] = useState("");

  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const micStreamRef = useRef(null);

  const [lastScorePct, setLastScorePct] = useState(null);
  const [improveWord, setImproveWord] = useState({ word: "sales", pct: 76 });
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pushMessage(msg, delayMs = 0) {
  if (delayMs) await wait(delayMs);
  setMessages((prev) => [...prev, msg]);
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
    setAnalyzeStatus("");

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
setAnalyzeStatus("Analyzing…");


// Hide the “Your turn” bubble while we analyze (prevents duplicate line)
const spokenText = targetLine; // snapshot of the prompt you just spoke
const userText = String(spokenText || "").trim();

setTargetLine("");

const controller = new AbortController();
const timeoutId = setTimeout(() => {
  try { controller.abort(); } catch {}
}, 12000);

    try {
      // 1) score pronunciation via SpeechSuper (same endpoint as Coach/Record)
      const base = getApiBase();
      const fd = new FormData();
      fd.append("audio", blob, "clip.webm");

      // IMPORTANT: we score against AI’s "expected short reply"
      fd.append("refText", spokenText);

      fd.append("accent", accentUi === "en_br" ? "en_br" : "en_us");

      const r = await fetch(`${base}/api/analyze-speech`, {
  method: "POST",
  body: fd,
  signal: controller.signal,
});
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
      setAnalyzeStatus("");

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
      // 3) Append the user message (score the line that was visible when recording started)


await pushMessage(
  {
    role: "user",
    speaker: "You",
    text: userText,
    score: Math.round(overall),
    wordScores: Array.from(wordScoreMap.entries()),
  },
  0
);

const turn = scenario.turns?.[turnIndex];

if (turn) {
  // assistant reply (fade in after the user result)
  await pushMessage(
    {
      role: "assistant",
      speaker: scenario.partnerName || "AI Partner",
      text: turn.assistantText,
    },
    420
  );

  // next expected user line (after assistant appears)
  await wait(260);
  setTargetLine(turn.nextUserLine || "");
  setTurnIndex((i) => i + 1);
} else {
  setTargetLine("");
}





      // progress +1 (real counter)
      const next = Math.min((readProgress() || 0) + 1, scenario.total || 999);
      writeProgress(next);
    } catch (e) {
      // if you want: show error as system message
    setAnalyzeStatus("Analyze failed — try again.");


      setMessages((prev) => [...prev, { role: "system", speaker: "System", text: String(e?.message || e) }]);



   } finally {
  clearTimeout(timeoutId);
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
    zIndex: 9999999999, // always above tab bar

        // backdrop overlay (so the page behind is visually hidden)
       background: "#0B1220", // fully opaque backdrop (nothing behind is visible)


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
          <div style={{ display: "grid", gap: 8 }}>
          <AnimatePresence initial={false}>
  {messages.map((m, idx) => {
    const k = `${m.role}_${idx}`;

    if (m.role === "assistant") {
      return (
        <motion.div
          key={k}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          style={{ display: "grid", gap: 4 }}
        >
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.40)", fontWeight: 900, fontSize: 12 }}>
            {m.speaker}
          </div>

          <div
            style={{
width: "min(440px, 86%)",
marginLeft: 32,
              marginRight: "auto",
              transform: "none",
              background: "rgba(59,130,246,0.85)",
borderRadius: 16,
padding: "11px 14px",
fontSize: 18,
              fontSize: 16,
              lineHeight: 1.18,
              boxShadow: "0 18px 46px rgba(0,0,0,0.32)",
            }}
          >
            {m.text}
          </div>
        </motion.div>
      );
    }

    if (m.role === "user") {
      return (
        <motion.div
          key={k}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          style={{ display: "grid", gap: 6 }}
        >
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontWeight: 900, fontSize: 12 }}>
            You
          </div>

          <div
            style={{
              width: "min(360px, 78%)",
              marginLeft: "auto",
              marginRight: 40,
              transform: "none",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 14,
padding: "9px 11px",
              position: "relative",
              boxShadow: "0 18px 46px rgba(0,0,0,0.32)",
            }}
          >
            <div style={{ fontWeight: 850, fontSize: 15, lineHeight: 1.22 }}>
              {m.wordScores ? renderScoredLine(m.text, new Map(m.wordScores)) : (
                <span style={{ color: "rgba(34,197,94,0.95)" }}>{m.text}</span>
              )}
            </div>

            {Number.isFinite(m.score) ? (
              <div
                style={{
                  position: "absolute",
                  right: 8,
                  top: 8,
                  background: "rgba(34,197,94,0.95)",
                  color: "#04110A",
                  fontWeight: 950,
                  borderRadius: 9,
                  padding: "4px 8px",
                  fontSize: 12,
                  lineHeight: 1,

                }}
              >
                {Math.round(m.score)}%
              </div>
            ) : null}
          </div>

          {/* Improve bar like screenshot */}
          <div
            style={{
              marginTop: -2,
              margin: "0 auto",
              width: "min(360px, 78%)",
        marginLeft: "auto",
marginRight: 40,          // align with user bubble (same marginRight)
transform: "none",   
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
borderRadius: 14,
padding: "9px 10px",
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
              <div style={{ fontWeight: 900, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>You can improve</div>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 999,
               padding: "6px 10px",
fontWeight: 950,
fontSize: 13,

              }}
            >
              <span style={{ color: "rgba(255,255,255,0.85)" }}>{improveWord.word}</span>
              <span style={{ color: "rgba(245,158,11,0.95)" }}>{improveWord.pct}%</span>
              <ChevronRight className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.65)" }} />
            </div>
          </div>
        </motion.div>
      );
    }

    // system / fallback
    return (
      <motion.div
        key={k}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={{ textAlign: "center", color: "rgba(255,255,255,0.50)", fontWeight: 900 }}
      >
        {m.text}
      </motion.div>
    );
  })}
</AnimatePresence>

        <AnimatePresence initial={false}>
  {targetLine ? (
    <motion.div
      key="target_line"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      style={{ display: "grid", gap: 10 }}
    >
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
          width: "min(360px, 78%)",
          maxWidth: "100%",
          boxSizing: "border-box",
          marginLeft: "auto",
marginRight: 40,
transform: "none",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 18,
padding: "10px 14px 12px",
paddingRight: 62,

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

        <div style={{ fontWeight: 850, fontSize: 15, lineHeight: 1.22 }}>
          <span style={{ color: "rgba(255,255,255,0.92)" }}>{targetLine}</span>
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
    </motion.div>
  ) : null}
</AnimatePresence>



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

        {isRecording ? "Recording…" : isAnalyzing ? (analyzeStatus || "Analyzing…") : ""}

        </div>
      </div>
    </motion.div>
  );
}
