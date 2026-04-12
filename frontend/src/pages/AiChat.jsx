//src/pages/AiChat.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, StopCircle, X, ChevronRight, Volume2 } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import { AI_CHAT_LEVELS } from "../data/aiChatScenarios.js";
import { pfColorForPct } from "../components/PhonemeFeedback.jsx";
import { analyzeSpeechPSM } from "../lib/analyzeSpeechPSM.js";
import { useNavigate } from "react-router-dom";
import { useProStatus } from "../providers/PurchasesProvider.jsx";


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
  const nav = useNavigate();
const { isPro } = useProStatus();

function openPaywallForLevel() {
  nav(`/pro?src=level_locked&return=/ai-chat`);
}

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
  const [activeScenario, setActiveScenario] = useState(() => {
  return window.history.state?.usr?.resumeScenario?.scenario || null;
});
  const levels = useMemo(() => AI_CHAT_LEVELS, []);
  useEffect(() => {
  const resume = window.history.state?.usr?.resumeScenario;
  if (!resume?.scenario) return;
  setActiveScenario(resume.scenario);
}, []);
useEffect(() => {
  const html = document.documentElement;
  const body = document.body;

  const prevHtmlOverflow = html.style.overflow;
  const prevBodyOverflow = body.style.overflow;
  const prevHtmlOverscroll = html.style.overscrollBehavior;
  const prevBodyOverscroll = body.style.overscrollBehavior;
  const prevHtmlBg = html.style.background;
  const prevBodyBg = body.style.background;

  const tabBar = document.querySelector("[data-tabbar]");
  const prevTabbarDisplay = tabBar?.style.display;

  if (activeScenario) {
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    html.style.background = "#0B1220";
    body.style.background = "#0B1220";

    if (tabBar) tabBar.style.display = "none";
  } else {
    html.style.overflow = prevHtmlOverflow || "";
    body.style.overflow = prevBodyOverflow || "";
    html.style.overscrollBehavior = prevHtmlOverscroll || "";
    body.style.overscrollBehavior = prevBodyOverscroll || "";
    html.style.background = prevHtmlBg || "";
    body.style.background = prevBodyBg || "";

    if (tabBar) tabBar.style.display = prevTabbarDisplay || "";
  }

  return () => {
    html.style.overflow = prevHtmlOverflow || "";
    body.style.overflow = prevBodyOverflow || "";
    html.style.overscrollBehavior = prevHtmlOverscroll || "";
    body.style.overscrollBehavior = prevBodyOverscroll || "";
    html.style.background = prevHtmlBg || "";
    body.style.background = prevBodyBg || "";

    if (tabBar) tabBar.style.display = prevTabbarDisplay || "";
  };
}, [activeScenario]);


  
    return (
   <div
  className="page"
 style={{
  position: "relative",
  minHeight: "100vh",
  background: "#FFFFFF",
  paddingBottom: 0,
  paddingTop: "var(--safe-top)",
  display: "flex",
  flexDirection: "column",
  overflowX: "hidden",
}}

>
 

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="mx-auto max-w-[860px]" style={{ width: "100%" }}>
       

          {/* White sheet */}
          <div
            style={{
  flex: 1,
  background: "transparent",
  borderRadius: 0,
  boxShadow: "none",
  padding: "0 16px",
  paddingTop: 12,
  paddingBottom: "calc(16px + var(--safe-bottom))",
}}


          >
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              {levels.map((lvl) => {
                const completedInLevel = lvl.scenarios.filter((s) => readProgress(s.id) >= s.total).length;
                const totalInLevel = lvl.scenarios.length;

                return (
                  <div key={`lvl_${lvl.level}`} style={{ marginTop: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                     <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
  <div style={{ fontSize: 40, fontWeight: 950, letterSpacing: -0.6, color: "rgba(17,24,39,0.92)" }}>
    Level {lvl.level}
  </div>

{!isPro && Number(lvl.level) > 1 && (
  <div
    style={{
      fontSize: 12,
      fontWeight: 950,
      opacity: 1,
      borderRadius: 999,
      padding: "4px 10px",
      border: "1px solid rgba(161, 98, 7, 0.35)",
      background: "linear-gradient(180deg, rgba(255,215,128,0.95), rgba(245,158,11,0.95))",
      color: "rgba(17,24,39,0.92)",
      boxShadow: "0 8px 18px rgba(245,158,11,0.22)",
      letterSpacing: 0.2,
            position: "relative",
      top: -6,
    }}
  >
    Premium
  </div>
)}
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

                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      {lvl.scenarios.map((s, idx) => {
                        const done = readProgress(s.id);
const locked = !isPro && Number(lvl.level) > 1;
                        return (
                          <button
                            key={s.id}
                            type="button"
                          onClick={() => {
  if (!isPro && Number(lvl.level) > 1) {
    openPaywallForLevel();
    return;
  }

  const resume = window.history.state?.usr?.resumeScenario || null;
  const nextScenario = { ...s, level: lvl.level };

  if (resume?.scenario?.id !== nextScenario.id) {
    nav("/ai-chat", { replace: true, state: {} });
  }

  setActiveScenario(nextScenario);
}}

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
    gap: 12,
    padding: "8px 10px",
    borderRadius: 16,
    border: locked ? "1px solid rgba(17,24,39,0.08)" : "1px solid rgba(17,24,39,0.10)",
    background: locked ? "rgba(17,24,39,0.04)" : "#FFFFFF", // 👈 key change
    opacity: locked ? 0.75 : 1,
  }}
>
                              {/* left node */}
                              <div style={{ position: "relative", width: 72, height: 72, flex: "0 0 auto" }}>
                                <div
                                  style={{
                                    width: 72,
height: 72,
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
                                    fontSize: 26,
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
  onClose={() => {
    nav("/ai-chat", { replace: true, state: {} });
    setActiveScenario(null);
  }}
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
  const nav = useNavigate();
  const rawResume = window.history.state?.usr?.resumeScenario || null;
const resume = rawResume?.scenario?.id === scenario?.id ? rawResume : null;

const [messages, setMessages] = useState(() => {
  if (resume?.messages?.length) return resume.messages;
  return [
    {
      role: "assistant",
      speaker: scenario.partnerName || "AI Partner",
      text: scenario.opening || "Hi! Ready to start?",
    },
  ];
});
const [turnIndex, setTurnIndex] = useState(() => Number.isFinite(resume?.turnIndex) ? resume.turnIndex : 0);
const [isComplete, setIsComplete] = useState(() => !!resume?.isComplete);

const totalTurns = Array.isArray(scenario?.turns) ? scenario.turns.length : 0;

function resetScenario() {
  stopScenarioTts();
  stopAll();

  setMessages([
    {
      role: "assistant",
      speaker: scenario.partnerName || "AI Partner",
      text: scenario.opening || "Hi! Ready to start?",
    },
  ]);
  setTurnIndex(0);
  setTargetLine(scenario.firstUserLine || "");
  setIsComplete(false);
  setAnalyzeStatus("");
  setIsAnalyzing(false);
  setIsRecording(false);
}

useEffect(() => {
  window.dispatchEvent(new CustomEvent("ac:scenarioOverlay", { detail: { open: true } }));

  const el = messagesScrollRef.current;
  if (el) {
    const onTouchStart = (e) => {
      const touch = e.touches?.[0];
      if (!touch) return;
      touchStartYRef.current = touch.clientY;
      touchStartScrollTopRef.current = el.scrollTop;
    };

    const onTouchMove = (e) => {
      const touch = e.touches?.[0];
      if (!touch) return;

      const currentY = touch.clientY;
      const deltaY = currentY - touchStartYRef.current;

      const scrollTop = el.scrollTop;
      const maxScrollTop = el.scrollHeight - el.clientHeight;

      const pullingDownAtTop = scrollTop <= 0 && deltaY > 0;
      const pullingUpAtBottom = scrollTop >= maxScrollTop - 1 && deltaY < 0;

      if (pullingDownAtTop || pullingUpAtBottom) {
        e.preventDefault();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      stopScenarioTts();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      window.dispatchEvent(new CustomEvent("ac:scenarioOverlay", { detail: { open: false } }));
    };
  }

  return () => {
    stopScenarioTts();
    window.dispatchEvent(new CustomEvent("ac:scenarioOverlay", { detail: { open: false } }));
  };
}, []);

  // AI returns an "expected short reply" that you score against
  const [targetLine, setTargetLine] = useState(() => {
  if (typeof resume?.targetLine === "string") return resume.targetLine;
  return scenario.firstUserLine || "";
});
useEffect(() => {
  if (resume?.scenario?.id === scenario?.id) return;

  setMessages([
    {
      role: "assistant",
      speaker: scenario.partnerName || "AI Partner",
      text: scenario.opening || "Hi! Ready to start?",
    },
  ]);
  setTurnIndex(0);
  setIsComplete(false);
  setTargetLine(scenario.firstUserLine || "");
  setAnalyzeStatus("");
  setIsAnalyzing(false);
  setIsRecording(false);
}, [scenario?.id]);
const ttsAudioRef = useRef(null);
const activeTtsUrlRef = useRef("");

function stopScenarioTts() {
  try {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      ttsAudioRef.current.onended = null;
      ttsAudioRef.current.onerror = null;
    }
  } catch {}

  if (activeTtsUrlRef.current) {
    try {
      URL.revokeObjectURL(activeTtsUrlRef.current);
    } catch {}
    activeTtsUrlRef.current = "";
  }
}

async function speakTarget() {
  const txt = String(targetLine || "").trim();
  if (!txt) return;

  try {
    stopScenarioTts();

    const base = getApiBase();

    const res = await fetch(`${base}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: txt,
        accent: accentUi === "en_br" ? "en_br" : "en_us",
        rate: Number(settings?.ttsRate ?? 1),
      }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || "TTS failed");
    }

    const buf = await res.arrayBuffer();
    const mime = (res.headers.get("content-type") || "audio/mpeg").split(";")[0].trim();
    const blob = new Blob([buf], { type: mime });
    const url = URL.createObjectURL(blob);

    if (!ttsAudioRef.current) {
      ttsAudioRef.current = new Audio();
    }

    activeTtsUrlRef.current = url;
    ttsAudioRef.current.src = url;
    ttsAudioRef.current.volume = Math.max(0, Math.min(1, Number(settings?.volume ?? 0.6)));

    ttsAudioRef.current.onended = () => {
      if (activeTtsUrlRef.current) {
        try {
          URL.revokeObjectURL(activeTtsUrlRef.current);
        } catch {}
        activeTtsUrlRef.current = "";
      }
    };

    ttsAudioRef.current.onerror = () => {
      if (activeTtsUrlRef.current) {
        try {
          URL.revokeObjectURL(activeTtsUrlRef.current);
        } catch {}
        activeTtsUrlRef.current = "";
      }
    };

    await ttsAudioRef.current.play();
  } catch (err) {
    console.error("[AiChat] scenario TTS failed", err);
  }
}


function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
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
  const wordScores = apiWords
    .map((w) => wordScore100LikePSM(w))
    .filter((v) => Number.isFinite(v));

  const overall = wordScores.length
    ? Math.round(wordScores.reduce((a, b) => a + b, 0) / wordScores.length)
    : 0;

  return { overall, wordScores };
}


// Word-level coloring from SpeechSuper words[] (best-effort)
// PSM-style word scores IN ORDER (keeps duplicates + positions)
function extractWordScoresInOrder(wordsArr) {
  const ws = Array.isArray(wordsArr) ? wordsArr : [];
  // ✅ PSM-style word scores in order (keep nulls to preserve positions)
  return ws.map((w) => wordScore100LikePSM(w));
}



function isWordLike(cleaned) {
  // "sales", "I'm", "2026" => true. Pure punctuation => false.
  return !!String(cleaned || "").match(/[A-Za-z0-9]/);
}

// Render text by consuming wordScores[] sequentially (index-based, keeps duplicates)
function renderScoredLineByIndex(text, wordScores) {
  const tokens = tokenizeWithSeparators(text);
  let wi = 0;

  return tokens.map((tok, i) => {
    if (/^\s+$/.test(tok)) return <span key={`t_${i}`}>{tok}</span>;

    const cleaned = tok.replace(/^[^\w']+|[^\w']+$/g, "");

    // punctuation-only token (don’t consume a word score)
    if (!isWordLike(cleaned)) {
      return (
        <span key={`t_${i}`} style={{ color: "rgba(255,255,255,0.92)" }}>
          {tok}
        </span>
      );
    }

    const pct = Array.isArray(wordScores) ? wordScores[wi] : null;
    wi += 1;

    const style = pct == null ? { color: "rgba(255,255,255,0.92)" } : { color: pfColorForPct(pct) };
    return (
      <span key={`t_${i}`} style={style}>
        {tok}
      </span>
    );
  });
}



// Split text into tokens while preserving spaces/punctuation
function tokenizeWithSeparators(text) {
  return String(text || "").match(/(\s+|[^\s]+)/g) || [];
}


function renderScoredLine(text, wordScoreMap) {
  const tokens = tokenizeWithSeparators(text);
  return tokens.map((tok, i) => {
    // keep whitespace as-is
    if (/^\s+$/.test(tok)) return <span key={`t_${i}`}>{tok}</span>;

    // strip punctuation for lookup, but keep original token
    const cleaned = tok.replace(/^[^\w']+|[^\w']+$/g, "");
    const pct = cleaned ? wordScoreMap.get(cleaned.toLowerCase()) : null;

    const style = pct == null ? { color: "rgba(255,255,255,0.92)" } : { color: pfColorForPct(pct) };
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
  const messagesScrollRef = useRef(null);
  const touchStartYRef = useRef(0);
  const touchStartScrollTopRef = useRef(0);

  const [lastScorePct, setLastScorePct] = useState(null);
  const [improveWord, setImproveWord] = useState({ word: "sales", pct: 76 });
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pushMessage(msg, delayMs = 0) {
  if (delayMs) await wait(delayMs);
  setMessages((prev) => [...prev, msg]);
}
function TinySpinner() {
  return (
    <span
      aria-hidden
      style={{
        width: 14,
        height: 14,
        borderRadius: 999,
        border: "2px solid rgba(255,255,255,0.28)",
        borderTopColor: "rgba(255,255,255,0.92)",
        display: "inline-block",
        animation: "acSpin 0.9s linear infinite",
      }}
    />
  );
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
const userAudioUrl = URL.createObjectURL(blob);

setIsAnalyzing(true);
setAnalyzeStatus("Analyzing…");


// Hide the “Your turn” bubble while we analyze (prevents duplicate line)
const spokenText = targetLine; // snapshot of the prompt you just spoke
const userText = String(spokenText || "").trim();

setTargetLine("");

try {
  const base = getApiBase();

const { json, psmOverall, psmWordScoresInOrder } = await analyzeSpeechPSM({
  base,
  audioBlob: blob,
  refText: spokenText,
  accent: accentUi === "en_br" ? "en_br" : "en_us",
  timeoutMs: 12000,
  slack: 1,
});


  const overall = Number(psmOverall ?? 0);
  const orderedWordScores = Array.isArray(psmWordScoresInOrder) ? psmWordScoresInOrder : [];

  setAnalyzeStatus("");

  // pick worst word (aligned with json.words via orderedWordScores index)
  let worstWord = null;
  try {
    const ws = Array.isArray(json?.words) ? json.words : [];
    for (let i = 0; i < ws.length; i++) {
     const wtxt = String(ws[i]?.word || "").trim();
     const pct = orderedWordScores[i];
    if (!wtxt || !Number.isFinite(pct)) continue;
    if (!worstWord || pct < worstWord.pct) worstWord = { word: wtxt, pct };
    }
  } catch {}
 if (worstWord) setImproveWord(worstWord);




      setAnalyzeStatus("");

      // 2) show "You can improve <word> <pct>" like screenshot (placeholder extraction)
      // If SpeechSuper words exist, pick lowest word score, else keep placeholder.
      try {
        const ws = Array.isArray(json?.words) ? json.words : [];
        let worst = null;

        for (const w of ws) {
          const wtxt = String(w?.word || "").trim();
        let pct = wordScore100LikePSM(w);
if (!Number.isFinite(pct)) {
  const sc = Number(w?.accuracyScore ?? w?.overallAccuracy ?? w?.score ?? w?.accuracy ?? NaN);
  pct = Number.isFinite(sc) ? (sc <= 1 ? Math.round(sc * 100) : Math.round(sc)) : null;
}

          if (!wtxt || pct == null) continue;
          if (!worst || pct < worst.pct) worst = { word: wtxt, pct };
        }
        if (worst) setImproveWord(worst);
      } catch {}

      // 3) Append the user message (we show the expected reply text as what user intended to say)
      // 3) Append the user message (score the line that was visible when recording started)

 const practicePayload = {
   ...json,
   // PracticeMyText expects these fields:
   overall: Math.round(overall),
   pronunciation: Math.round(overall),
   overallAccuracy: Math.round(overall),
  words: Array.isArray(json?.words) ? json.words : [],
  refText: userText,
  accent: accentUi === "en_br" ? "en_br" : "en_us",
  userAudioBlob: blob,
  userAudioUrl,
 createdAt: Date.now(),
 };

await pushMessage(
  {
    role: "user",
    speaker: "You",
    text: userText,
    score: Math.round(overall),
    wordScores: orderedWordScores, // ✅ per-index scores (keeps duplicates)
    improveWord: worstWord,
   practicePayload,
  },
  0
);


const turn = (Array.isArray(scenario?.turns) ? scenario.turns : [])[turnIndex];

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
setIsComplete(true);
}

if (turnIndex + 1 >= totalTurns) {
  setIsComplete(true);
}





      // progress +1 (real counter)
      const next = Math.min((readProgress() || 0) + 1, scenario.total || 999);
      writeProgress(next);
    } catch (e) {
      // if you want: show error as system message
    setAnalyzeStatus(e?.name === "AbortError" ? "Analysis timed out. Please try again." : "Analyze failed — try again.");


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
  zIndex: 9999999999,
  background: "#0B1220",
  paddingTop: "calc(var(--safe-top) + 12px)",
  paddingLeft: 12,
  paddingRight: 12,
  paddingBottom: "calc(6px + var(--safe-bottom))",
  overflow: "hidden",
  overscrollBehavior: "none",
  WebkitOverflowScrolling: "touch",
  touchAction: "none",
}}

    >
     <div
  style={{
    maxWidth: 760,
    margin: "0 auto",
    height: "100%",
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
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
  stopScenarioTts();
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
        <div
  ref={messagesScrollRef}
  style={{
    minHeight: 0,
    height: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    padding: "6px 4px",
    WebkitOverflowScrolling: "touch",
    overscrollBehavior: "none",
    touchAction: "pan-y",
    background: "#0B1220",
  }}
>
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
    display: "inline-block",
    width: "fit-content",
    maxWidth: "min(440px, 86%)",
    marginLeft: 6,
    marginRight: "auto",
    transform: "none",
    background: "rgba(59,130,246,0.85)",
    borderRadius: 16,
    padding: "11px 14px",
    fontSize: 16,
    lineHeight: 1.18,
    boxShadow: "0 18px 46px rgba(0,0,0,0.32)",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
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
              marginRight: 8,
              transform: "none",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 14,
padding: "9px 11px",
paddingRight: 72,
              position: "relative",
              boxShadow: "0 18px 46px rgba(0,0,0,0.32)",
            }}
          >
            <div style={{ fontWeight: 850, fontSize: 15, lineHeight: 1.22 }}>
             {Array.isArray(m.wordScores) ? renderScoredLineByIndex(m.text, m.wordScores) : (
  <span style={{ color: "rgba(255,255,255,0.92)" }}>{m.text}</span>
)}

            </div>
          </div>

       {/* Improve bar like screenshot */}
<button
  type="button"
  onClick={() => {
    const payload = m?.practicePayload || null;
    if (!payload) return;

    try { window?.speechSynthesis?.cancel?.(); } catch {}
    stopAll();
    onClose();

   nav("/practice-my-text", {
  state: {
    mode: "coach",
    backRoute: "/ai-chat",
    result: payload,
    scenarioResume: {
      scenario,
      messages,
      turnIndex,
      isComplete,
      targetLine,
    },
  },
});
  }}
  disabled={!m?.practicePayload}
  style={{
    marginTop: -2,
    margin: "0 auto",
    width: "min(360px, 78%)",
    marginLeft: "auto",
    marginRight: 8,

    transform: "none",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: "9px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    cursor: m?.practicePayload ? "pointer" : "not-allowed",
  }}
>

           <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
  <div style={{ fontWeight: 900, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
    {m?.score >= 70
  ? "Very good, but you can improve"
  : "You can improve"}
  </div>
</div>


           <button
  type="button"
  onClick={() => {
    const payload = m?.practicePayload || null;
    if (!payload) return;

    // close the overlay first so it doesn't sit on top of PracticeMyText
    try { window?.speechSynthesis?.cancel?.(); } catch {}
    stopAll();
    onClose();

   nav("/practice-my-text", {
  state: {
    mode: "coach",
    backRoute: "/ai-chat",
    result: payload,
    scenarioResume: {
      scenario,
      messages,
      turnIndex,
      isComplete,
      targetLine,
    },
  },
});
  }}
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
    cursor: m?.practicePayload ? "pointer" : "not-allowed",
  }}
  disabled={!m?.practicePayload}
>
<span style={{ color: "rgba(245,158,11,0.95)" }}>
  {Number.isFinite(m?.score) ? `${m.score}%` : ""}
</span>

  <ChevronRight className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.65)" }} />
</button>

        </button>
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
marginRight: 8,
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


<style>{`
  @keyframes acSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes acPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }
`}</style>

{/* Mic / Completion actions */}
{isComplete ? (
  <div style={{ display: "flex", justifyContent: "center", gap: 12, paddingBottom: 8 }}>
    <button
      type="button"
      onClick={() => {
        try { window?.speechSynthesis?.cancel?.(); } catch {}
        stopAll();
        onClose();
      }}
      style={{
        padding: "12px 16px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.88)",
        fontWeight: 950,
        cursor: "pointer",
      }}
    >
      Exit
    </button>

    <button
      type="button"
      onClick={resetScenario}
      style={{
        padding: "12px 16px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.10)",
        color: "rgba(255,255,255,0.92)",
        fontWeight: 950,
        cursor: "pointer",
      }}
    >
      Try again
    </button>
  </div>
) : (
  <div style={{ display: "grid", placeItems: "center", paddingBottom: 0, marginTop: 6 }}>

  <div style={{ position: "relative", width: 76, height: 76 }}>
        <button
      type="button"
      onClick={toggleRecord}
      disabled={isAnalyzing}
      style={{
        width: 76,
        height: 76,
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
      {isRecording ? (
        <StopCircle className="h-8 w-8" style={{ color: "white" }} />
      ) : (
        <Mic className="h-8 w-8" style={{ color: "white" }} />
      )}
    </button>

    {/* Overlay når analyzing */}
    {isAnalyzing && (
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: "rgba(0,0,0,0.22)",
          border: "1px solid rgba(255,255,255,0.14)",
          display: "grid",
          placeItems: "center",
          pointerEvents: "none",
          animation: "acPulse 1.2s ease-in-out infinite",
          backdropFilter: "blur(2px)",
        }}
      >
        <TinySpinner />
      </div>
    )}
  </div>

  {/* Label under knappen */}
  <div
    style={{
      marginTop: 10,
      minHeight: 18, // så layout ikke hopper
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontWeight: 900,
      fontSize: 13,
      color: "rgba(255,255,255,0.72)",
    }}
  >
    {isRecording ? (
      <>Recording…</>
    ) : isAnalyzing ? (
      <>
        <TinySpinner />
        <span>{analyzeStatus || "Analyzing…"}</span>
      </>
    ) : null}
  </div>
</div>
)}

      </div>
    </motion.div>
  );
}