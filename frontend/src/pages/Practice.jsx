// src/pages/Practice.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { ChevronLeft, Mic, Target, Bookmark, StopCircle } from "lucide-react";
import { getBookmarks } from "../lib/bookmarks";
import { useSettings } from "../lib/settings-store.jsx";
import * as sfx from "../lib/sfx.js";
import { useProStatus } from "../providers/PurchasesProvider.jsx";


const IS_PROD = !!import.meta?.env?.PROD;
const RESULT_KEY = "ac_practice_my_text_result_v1";

const PRACTICE_DAILY_LIMIT_FREE = 3;
const practiceKeyForToday = () => {
  const d = new Date();
  const day = d.toISOString().slice(0, 10); // YYYY-MM-DD
  return `ac_practice_attempts_${day}`;
};

function getAttemptsUsedToday() {
  try {
    return Number(localStorage.getItem(practiceKeyForToday()) || 0);
  } catch {
    return 0;
  }
}

function incrementAttemptsToday() {
  try {
    const key = practiceKeyForToday();
    const n = Number(localStorage.getItem(key) || 0);
    localStorage.setItem(key, String(n + 1));
    return n + 1;
  } catch {
    return null;
  }
}

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

function clamp01(v) {
  const n = Number(v);
  if (!isFinite(n)) return null;
  return n <= 1 ? Math.max(0, Math.min(1, n)) : Math.max(0, Math.min(1, n / 100));
}

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
        ph.accuracyScore ??
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

function psmSentenceScoreFromApi(json) {
  const apiWords = Array.isArray(json?.words) ? json.words : [];
  const wordScores = apiWords.map((w) => wordScore100LikePSM(w)).filter((v) => Number.isFinite(v));
  const overall = wordScores.length ? Math.round(wordScores.reduce((a, b) => a + b, 0) / wordScores.length) : 0;
  return { overall, wordScores };
}

function sanitizeTextForSubmit(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim();
}

export default function Practice() {
  const nav = useNavigate();
  const { isPro } = useProStatus();

const [attemptsUsed, setAttemptsUsed] = useState(() => getAttemptsUsedToday());

useEffect(() => {
  // Opdatér når man kommer tilbage til skærmen (ny dag / restore / osv.)
  setAttemptsUsed(getAttemptsUsedToday());
}, []);

const attemptsLeft = isPro ? Infinity : Math.max(0, PRACTICE_DAILY_LIMIT_FREE - attemptsUsed);

function openPaywall(src) {
  nav(`/pro?src=${encodeURIComponent(src)}&return=/practice`);
}

      const { settings } = useSettings();
    const [accentUi, setAccentUi] = useState(settings?.accentDefault || "en_us");
useEffect(() => {
  setAccentUi(settings?.accentDefault || "en_us");
}, [settings?.accentDefault]);


  // keep SFX volume synced (0 = mute)
  useEffect(() => {
    sfx.setVolume(settings.volume ?? 0.6);
  }, [settings.volume]);
  const canPlaySfx = (settings.volume ?? 0) > 0.001;

  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isBusy = isRecording || isAnalyzing;

  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const lastUrlRef = useRef(null);


  // Keep it aligned with Record (record input maxLength=220 in Record.jsx)
  const MAX_LEN = 120;

const [text, setText] = useState("");
const [expanded, setExpanded] = useState(false);
const [isOpening, setIsOpening] = useState(false);
const openStartTimerRef = useRef(null);

useEffect(() => {
  return () => {
    try {
      if (openStartTimerRef.current) clearTimeout(openStartTimerRef.current);
    } catch {}
  };
}, []);

const [collapsedReady, setCollapsedReady] = useState(true);

// Show collapsed icon/title slightly BEFORE the close animation fully finishes
const CLOSE_DURATION_MS = 550;      // matcher close duration 0.45s
const COLLAPSED_REVEAL_EARLY_MS = 120; // reveal ~120ms før close er færdig
const closeRevealTimerRef = React.useRef(null);
const OPEN_DURATION_MS = 850; // matcher din open duration
const OPEN_FOCUS_DELAY_MS = 350; // øg hvis du vil have endnu langsommere
const openFocusTimerRef = React.useRef(null);
const textareaRef = useRef(null);

  const [kb, setKb] = useState(0);
useEffect(() => {
  // always clear any pending timer
  if (closeRevealTimerRef.current) {
    clearTimeout(closeRevealTimerRef.current);
    closeRevealTimerRef.current = null;
  }

  if (expanded) {
    // hiding collapsed header immediately when opening
    setCollapsedReady(false);
    return;
  }

  // when closing, reveal a bit before animation ends
  const ms = Math.max(0, CLOSE_DURATION_MS - COLLAPSED_REVEAL_EARLY_MS);
  closeRevealTimerRef.current = setTimeout(() => {
    setCollapsedReady(true);
    closeRevealTimerRef.current = null;
  }, ms);
}, [expanded]);

useEffect(() => {
  if (openFocusTimerRef.current) {
    clearTimeout(openFocusTimerRef.current);
    openFocusTimerRef.current = null;
  }

  if (!expanded) return;

  openFocusTimerRef.current = setTimeout(() => {
    try {
      textareaRef.current?.focus?.();
    } catch {}
    openFocusTimerRef.current = null;
  }, Math.max(0, OPEN_DURATION_MS - OPEN_FOCUS_DELAY_MS));

  return () => {
    if (openFocusTimerRef.current) {
      clearTimeout(openFocusTimerRef.current);
      openFocusTimerRef.current = null;
    }
  };
}, [expanded]);


useEffect(() => {
  if (!expanded) {
    setKb(0);
    return;
  }

  const vv = window.visualViewport;
  if (!vv) return;

  const update = () => {
    const height = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    setKb(height);
  };

  update();
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);

  return () => {
    vv.removeEventListener("resize", update);
    vv.removeEventListener("scroll", update);
  };
}, [expanded]);

  const [bookmarkCount, setBookmarkCount] = useState(() => {
  try {
    const items = getBookmarks();
    return Array.isArray(items) ? items.length : 0;
  } catch {
    return 0;
  }
});

useEffect(() => {
  const refresh = () => {
    try {
      const items = getBookmarks();
      setBookmarkCount(Array.isArray(items) ? items.length : 0);
    } catch {
      setBookmarkCount(0);
    }
  };

  const onStorage = (e) => {
    if (e.key === "ac_bookmarks_v1" || e.key === "ac_bookmarks") refresh();
  };

  const onFocus = () => refresh();
  const onVis = () => {
    if (document.visibilityState === "visible") refresh();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVis);

  // initial
  refresh();

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVis);
  };
}, []);


  const safeBottom = "var(--safe-bottom)";
  const safeTop = "var(--safe-top)";
const clampedLen = Math.min(text.length, MAX_LEN);
const progressDeg = (clampedLen / MAX_LEN) * 360;


  const cards = useMemo(() => {
    return [
      {
        key: "practice_my_text",
        title: "Practice My Text",
        subtitle: "Type or paste your own text",
        Icon: Mic,
        onPress: () => openExpandedSlow(),
      },
      {
        key: "weakness",
        title: "Train your weakest sounds",
        subtitle: "Practice specific sounds",
        Icon: Target,
        onPress: () => {
  if (!isPro) return openPaywall("weakest_locked");
  nav("/weakness");
},
      },
      {
        key: "bookmarks",
        title: "Bookmarks",
      subtitle: `${bookmarkCount} saved`,
        Icon: Bookmark,
onPress: () => {
  if (!isPro) return openPaywall("bookmarks_locked");
  nav("/bookmarks");
},
      },
    ];
  }, [nav, bookmarkCount, isPro]);
function disposeRecorder() {
  try {
    mediaRecRef.current?.stream?.getTracks?.().forEach((t) => t.stop());
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

function stopRecording() {
  try {
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
  } catch {}
}

async function startRecording() {
  const cleaned = sanitizeTextForSubmit(text);
  if (!cleaned) return;

  try {
        // ✅ Free-tier gating: 3 attempts/day (count only when starting a recording)
    if (!isPro) {
      const used = getAttemptsUsedToday();
      if (used >= PRACTICE_DAILY_LIMIT_FREE) {
        openPaywall("practice_limit");
        return;
      }
      const next = incrementAttemptsToday();
      // Hold UI i sync
      if (typeof next === "number") setAttemptsUsed(next);
    }

    await ensureMic();
    chunksRef.current = [];
    mediaRecRef.current.start();
    setIsRecording(true);
    if (canPlaySfx) sfx.warm();
  } catch (e) {
    setIsRecording(false);
    if (!IS_PROD) console.warn("[Practice] mic error:", e);
    if (canPlaySfx) sfx.softFail();
  }
}

async function togglePracticeRecord() {
  if (isAnalyzing) return;
  if (isRecording) stopRecording();
  else await startRecording();
}

async function handleStop(rec) {
  setIsRecording(false);

  const chunks = chunksRef.current.slice();
  chunksRef.current = [];

  disposeRecorder();

  try {
    if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
  } catch {}

  const type = chunks[0]?.type || rec?.mimeType || "audio/webm";
  const blob = new Blob(chunks, { type });
  const localUrl = URL.createObjectURL(blob);
  lastUrlRef.current = localUrl;

  setIsAnalyzing(true);

  try {
    const refText = sanitizeTextForSubmit(text).slice(0, MAX_LEN);
    const base = getApiBase();

    const fd = new FormData();
    fd.append("audio", blob, "clip.webm");
    fd.append("refText", refText);
    // Brug din default accent hvis du vil – ellers bare en fast fallback:
    fd.append("accent", (accentUi === "en_br" ? "en_br" : "en_us"));
    fd.append("slack", String(settings?.slack ?? 0));

    const controller = new AbortController();
    const timeoutMs = 12000;
    const t = setTimeout(() => controller.abort(), timeoutMs);

    const r = await fetch(`${base}/api/analyze-speech`, {
      method: "POST",
      body: fd,
      signal: controller.signal,
    }).finally(() => clearTimeout(t));

    const ct = r.headers?.get("content-type") || "";
    const json = ct.includes("application/json") ? await r.json().catch(() => ({})) : {};

    if (!r.ok) throw new Error(json?.error || r.statusText || "Analyze failed");

    const psm = psmSentenceScoreFromApi(json);
    const overall = Number(psm?.overall ?? json?.overall ?? 0);

    const payload = {
      ...json,
      overall,
      pronunciation: overall,
      overallAccuracy: overall,
      psmWordScores: Array.isArray(psm?.wordScores) ? psm.wordScores : [],
      userAudioUrl: localUrl,
      userAudioBlob: blob,
      refText,
      accent: accentUi === "en_br" ? "en_br" : "en_us",
      createdAt: Date.now(),
    };

    try { sessionStorage.setItem(RESULT_KEY, JSON.stringify(payload)); } catch {}

    // IMPORTANT: gå direkte til feedback-siden med resultatet
    nav("/practice-my-text", {
  state: {
    result: payload,
    mode: "practice",
    backRoute: "/practice",
  },
});
  } catch (e) {
    if (!IS_PROD) console.warn("[Practice] analyze error:", e);
    if (canPlaySfx) sfx.softFail();
  } finally {
    setIsAnalyzing(false);
  }
}


function openExpandedSlow() {
  if (expanded || isOpening) return;

  setIsOpening(true);

  try { if (openStartTimerRef.current) clearTimeout(openStartTimerRef.current); } catch {}
  openStartTimerRef.current = setTimeout(() => {
    setExpanded(true);
    setIsOpening(false);
    openStartTimerRef.current = null;
  }, 180); // 👈 øg til 240/300 hvis du vil endnu langsommere start
}


return (
  <LayoutGroup id="practice-morph">
<div
  className="page"
  style={{
  minHeight: "100vh",
  position: "relative",
  background: "#FFFFFF",
  color: "var(--text)",
  paddingBottom: 0,
  paddingTop: "var(--safe-top)",
  display: "flex",
  flexDirection: "column",
}}

>


      <div
  style={{
    position: "relative",
    zIndex: 1,
    height: "100%",
flex: 1,

    display: "flex",
    flexDirection: "column",
  }}
>



        {/* White sheet under blue header */}
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
  paddingTop: 22,
  color: "var(--text)",
  paddingBottom: "calc(16px + var(--safe-bottom))",
}}


        >
          {/* Cards */}
          <div style={{ display: "grid", gap: 14 }}>
            {/* Practice My Text card (special because it has the collapsed input) */}
            <motion.div
              layoutId="practice-mytext-card"
              layout
              onClick={() => {
                if (!expanded) openExpandedSlow();
              }}
              role="button"
              tabIndex={0}
              onLayoutAnimationComplete={() => {
                if (!expanded && !collapsedReady) setCollapsedReady(true);
              }}
          transition={{
  layout: { type: "tween", duration: expanded ? 0.85 : 0.55, ease: [0.22, 1, 0.36, 1] },
  default: { duration: expanded ? 0.85 : 0.55, ease: [0.22, 1, 0.36, 1] },
}}


              style={{
                borderRadius: expanded ? 26 : 22,
                background: "var(--panel-bg)",
                border: "1px solid var(--panel-border)",
                boxShadow: expanded ? "0 18px 44px rgba(0,0,0,0.18)" : "0 8px 18px rgba(0,0,0,0.08)",
                padding: expanded ? 0 : 16,
                cursor: expanded ? "default" : "pointer",
                transformOrigin: "center",
                width: "100%",
              }}
            >
              {!expanded ? (
                <>
                  {/* COLLAPSED */}
                  <motion.div
                    initial={false}
                    animate={{
                      opacity: collapsedReady ? 1 : 0,
                      y: collapsedReady ? 0 : 6,
                    }}
                    transition={{
                      opacity: {
                        duration: collapsedReady ? 0.5 : 0.1,
                        ease: collapsedReady ? [0.16, 1, 0.3, 1] : [0.4, 0, 1, 1],
                      },
                      y: {
                        duration: collapsedReady ? 0.5 : 0.1,
                        ease: collapsedReady ? [0.16, 1, 0.3, 1] : [0.4, 0, 1, 1],
                      },
                    }}
                    style={{
                      pointerEvents: collapsedReady ? "auto" : "none",
                      willChange: "opacity, transform",
                    }}
                  >
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <div
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 999,
                          display: "grid",
                          placeItems: "center",
                          background: "rgba(139,92,246,0.14)",
                          border: `1px solid rgba(139,92,246,0.20)`,
                          flex: "0 0 auto",
                        }}
                      >
                        <Mic style={{ width: 22, height: 22, color: "rgba(139,92,246,0.95)" }} />
                      </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.2 }}>
    Practice Your Text
  </div>

  {!isPro && (
    <div style={{ marginTop: 4, opacity: 0.65, fontWeight: 800, fontSize: 13 }}>
      {attemptsLeft} / {PRACTICE_DAILY_LIMIT_FREE} free attempts left today
    </div>
  )}
</div>

                    </div>
                  </motion.div>

                  <div
                    style={{
                      marginTop: 14,
                      borderRadius: 18,
                      background: "rgba(17,24,39,0.04)",
                      border: `1px solid rgba(0,0,0,0.08)`,
                      padding: "14px 14px",
                      position: "relative",
                      minHeight: 70,
                    }}
                  >
                    <div style={{ color: "rgba(17,24,39,0.38)", fontWeight: 900, fontSize: 20 }}>
                      {text ? text : "Tap to type…"}
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        color: "var(--muted)",
                        fontWeight: 800,
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            background: `conic-gradient(#2196f3 ${progressDeg}deg, rgba(33,150,243,0.18) 0deg)`,
                            padding: 3,
                            flex: "0 0 auto",
                          }}
                        >
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              borderRadius: 999,
                              background: "var(--panel-bg)",
                            }}
                          />
                        </div>

                        <div>
                          {Math.min(text.length, MAX_LEN)} / {MAX_LEN}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* EXPANDED */}
                  <div
                    style={{
                  paddingTop: "10px",
                      minHeight: "100dvh",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", padding: "8px 12px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setExpanded(false)}
                          aria-label="Back"
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 999,
                            border: "1px solid var(--panel-border)",
                            background: "var(--panel-bg)",
                            boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
                            display: "grid",
                            placeItems: "center",
                            cursor: "pointer",
                          }}
                        >
                          <ChevronLeft style={{ width: 20, height: 20, color: "var(--text)" }} />
                        </button>

                        <div
                          style={{
                            flex: 1,
                            textAlign: "center",
                            fontWeight: 900,
                            fontSize: 18,
                            color: "var(--text)",
                          }}
                        >
                          Practice Your Text
                        </div>

                      <div style={{ position: "relative" }}>
  <select
    aria-label="Accent"
    value={accentUi}
    onChange={(e) => !isBusy && setAccentUi(e.target.value)}
    disabled={isBusy}
    style={{
      height: 42,
      borderRadius: 999,
      padding: "0 12px",
      fontWeight: 900,
      border: "1px solid var(--panel-border)",
      background: "var(--panel-bg)",
      boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
      outline: "none",
      cursor: isBusy ? "not-allowed" : "pointer",
      appearance: "none",
      paddingRight: 34,
    }}
    title="Accent"
  >
    <option value="en_us">🇺🇸</option>
    <option value="en_br">🇬🇧</option>
  </select>

  <span
    style={{
      position: "absolute",
      right: 10,
      top: "50%",
      transform: "translateY(-50%)",
      opacity: 0.55,
      pointerEvents: "none",
      fontWeight: 900,
    }}
  >
    ▾
  </span>
</div>
                      </div>
                    </div>

                    <div
                      style={{
                        maxWidth: 720,
                        margin: "0 auto",
                        padding: "10px 16px 0",
                        flex: 1,
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          borderRadius: 26,
                          background: "var(--panel-bg)",
                          border: "1px solid var(--panel-border)",
                          boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
                          padding: 18,
                        }}
                      >
                        <textarea
  ref={textareaRef}
                          value={text}
                          onChange={(e) => setText(String(e.target.value || "").slice(0, MAX_LEN))}
                          maxLength={MAX_LEN}
                          placeholder="Start typing…"
                          style={{
                            width: "100%",
                            minHeight: 220,
                            borderRadius: 18,
                            border: `1px solid rgba(0,0,0,0.10)`,
                            background: "rgba(17,24,39,0.04)",
                            padding: 14,
                            outline: "none",
                            fontSize: 18,
                            fontWeight: 800,
                            color: "var(--text)",
                            resize: "none",
                          }}
                        />

                        <div
                          style={{
                            marginTop: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            color: "var(--muted)",
                            fontWeight: 900,
                          }}
                        >
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 999,
                              background: `conic-gradient(#2196f3 ${progressDeg}deg, rgba(33,150,243,0.18) 0deg)`,
                              padding: 3,
                              flex: "0 0 auto",
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: 999,
                                background: "var(--panel-bg)",
                              }}
                            />
                          </div>

                          <div>
                            {Math.min(text.length, MAX_LEN)} / {MAX_LEN}
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: `14px 0 calc(${safeBottom} + ${kb}px + 14px)` }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePracticeRecord();
                          }}
                          disabled={!String(text || "").trim() || isAnalyzing}
                          style={{
                            width: "100%",
                            height: 56,
                            borderRadius: 18,
                            border: "none",
                            cursor: !String(text || "").trim() ? "not-allowed" : "pointer",
                            opacity: !String(text || "").trim() ? 0.6 : 1,
                            fontWeight: 900,
                            fontSize: 18,
                            color: "white",
                            background: "#2196f3",
                            boxShadow: "0 14px 28px rgba(0,0,0,0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                          }}
                        >
                          {isRecording ? (
                            <>
                              <StopCircle style={{ width: 20, height: 20, color: "white" }} />
                              Stop
                            </>
                          ) : (
                            <>
                              <Mic style={{ width: 20, height: 20, color: "white" }} />
                              {isAnalyzing ? "Analyzing…" : "Record"}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>

            {/* Weakness + Bookmarks cards */}
            {!expanded &&
              cards
                .filter((c) => c.key !== "practice_my_text")
                .map((c) => (
                  <div
                    key={c.key}
                    onClick={c.onPress}
                    role="button"
                    tabIndex={0}
                    style={{
                      borderRadius: 22,
                      background: "var(--panel-bg)",
                      border: "1px solid var(--panel-border)",
                      boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
                      padding: 16,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <div
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 999,
                          display: "grid",
                          placeItems: "center",
                          background: "rgba(33,150,243,0.10)",
                          border: `1px solid rgba(33,150,243,0.16)`,
                          flex: "0 0 auto",
                        }}
                      >
                        <c.Icon style={{ width: 22, height: 22, color: "rgba(33,150,243,0.95)" }} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.2 }}>{c.title}</div>
                        <div style={{ marginTop: 2, color: "var(--muted)", fontWeight: 700 }}>{c.subtitle}</div>
                      </div>

                      <div style={{ color: "rgba(17,24,39,0.35)", fontWeight: 900, fontSize: 20 }}>›</div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  </LayoutGroup>
);

}

