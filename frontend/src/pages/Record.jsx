// src/pages/Record.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { StopCircle, ChevronDown, ArrowUp } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import { updateStreak, readStreak } from "../lib/streak.js";
import * as sfx from "../lib/sfx.js";
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

const STATE_KEY = "ac_record_state_chat_v2";
const LAST_RESULT_KEY = "ac_last_result_v1";
const FEEDBACK_KEY = "ac_feedback_result_v1";
const INTRO_KEY = "ac_record_intro_v1";

function clamp01(v) {
  const n = Number(v);
  if (!isFinite(n)) return null;
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
  const wordScores = apiWords.map((w) => wordScore100LikePSM(w)).filter((v) => Number.isFinite(v));
  const overall = wordScores.length ? Math.round(wordScores.reduce((a, b) => a + b, 0) / wordScores.length) : 0;
  return { overall, wordScores };
}


/* ---------------- small helpers ---------------- */
function pickFeedback(json) {
  const overall = Number(json?.overall ?? json?.pronunciation ?? json?.overallAccuracy ?? 0);
  if (overall >= 95)
    return ["Unreal! 🔥", "Insane clarity! 🌟", "Flawless! 👑", "You’re on fire! 🚀"][Math.floor(Math.random() * 4)];
  if (overall >= 90)
    return ["Awesome work! 💪", "Super clean! ✨", "You nailed it! ✅", "Crisp & clear! 🎯"][Math.floor(Math.random() * 4)];
  if (overall >= 75)
    return ["Great progress — keep going! 🙌", "Nice! Try slightly slower. ⏱️", "Solid! Listen once more, then record. 👂"][
      Math.floor(Math.random() * 3)
    ];
  return ["Good start — emphasize the stressed syllable. 🔊", "Try again a bit slower. 🐢", "Listen once more, then record. 👂"][
    Math.floor(Math.random() * 3)
  ];
}

export default function Record() {
  const navigate = useNavigate();
  const location = useLocation(); // ✅ needed for nav("/record", { state: { seedText } })
  const { settings } = useSettings();


    // keep SFX volume synced with settings (0 = mute)
  useEffect(() => {
    sfx.setVolume(settings.volume ?? 0.6);
  }, [settings.volume]);
  const canPlaySfx = (settings.volume ?? 0) > 0.001;

  // streak (kept, but no daily goal UI)
  const [streak, setStreak] = useState(() => readStreak());

  // pronunciation recording / analyzing
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isBusy = isRecording || isAnalyzing;

  // ---- state ----
  const [accentUi, setAccentUi] = useState(settings.accentDefault || "en_us");
  useEffect(() => {
  if (isBusy) return;
  setAccentUi(settings.accentDefault || "en_us");
}, [settings.accentDefault, isBusy]);

  const [refText, setRefText] = useState("");
  const [err, setErr] = useState("");
const [showIntro, setShowIntro] = useState(() => {
  try {
    return localStorage.getItem(INTRO_KEY) !== "1";
  } catch {
    return true;
  }
});


  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const [lastUrl, setLastUrl] = useState(null);

  // ✅ full feedback shown on SAME page
  const [result, setResult] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
  const blurTimerRef = useRef(null);


function sanitizeTextForSubmit(raw) {
  // normalize whitespace, trim only when we actually submit
  return String(raw || "").replace(/\s+/g, " ").trim();
}

function sanitizeTextForPaste(raw) {
  // paste: keep it clean but don't block typing spaces later
  return String(raw || "").replace(/\s+/g, " ");
}


function closeIntro() {
  setShowIntro(false);
  try {
    localStorage.setItem(INTRO_KEY, "1");
  } catch {}
}


  // suggestions above input
  // --- Random word suggestions (1 word each) ---
const SUGGESTION_POOL = [
  "camera", "comfortable", "really", "alright", "world", "water", "thought",
  "through", "three", "thirty", "focus", "music", "record", "purple", "accent",
  "sentence", "coffee", "people", "problem", "market", "school", "future",
];

function pickRandomUnique(arr, n) {
  const a = arr.slice();
  // Fisher–Yates shuffle
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

const [suggestions, setSuggestions] = useState(() => pickRandomUnique(SUGGESTION_POOL, 6));

function refreshSuggestions() {
  setSuggestions(pickRandomUnique(SUGGESTION_POOL, 6));
}


  // restore on route entry
  useEffect(() => {
    setAccentUi(settings.accentDefault || "en_us");
    setErr("");

    // restore saved text + last result
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) {
  const saved = JSON.parse(raw);
  if (typeof saved.refText === "string") setRefText(saved.refText);
  // ❌ do NOT restore accentUi (must follow settings)
}
    } catch {}

    

    // seedText via route state (bookmarks handoff)
const seedFromState = String(location?.state?.seedText || "").trim();

// ✅ Always start fresh when entering Record tab (ALWAYS)
setResult(null);

// also kill last audio url
try {
  if (lastUrl) URL.revokeObjectURL(lastUrl);
} catch {}
setLastUrl(null);

// stop recorder if it somehow exists
disposeRecorder();
setIsRecording(false);
setIsAnalyzing(false);

// optional: clear any cached "last result"
try {
  sessionStorage.removeItem(LAST_RESULT_KEY);
  sessionStorage.removeItem(FEEDBACK_KEY);
} catch {}

// seedText via route state (bookmarks handoff)
if (seedFromState) {
  setRefText(seedFromState);
  setErr("");
}

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // persist state
useEffect(() => {
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ refText }));
  } catch {}
}, [refText]);


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

  async function startPronunciationRecord() {
    if (!refText.trim()) {
      setErr("Type something first.");
      return;
    }
    try {
      setErr("");
      await ensureMic();
      chunksRef.current = [];
      mediaRecRef.current.start();
      setIsRecording(true);
            if (canPlaySfx) sfx.warm();

    } catch (e) {
      if (!IS_PROD) setErr("Microphone error: " + (e?.message || String(e)));
else setErr("Microphone access is blocked. Please allow it and try again.");
      setIsRecording(false);
      if (canPlaySfx) sfx.softFail();
    }
  }

  function stopPronunciationRecord() {
    try {
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
    } catch {}
  }

  async function togglePronunciationRecord() {
        if (canPlaySfx) {
      sfx.warm();
      // volume is already synced via useEffect
    }

    if (isRecording) stopPronunciationRecord();
    else if (!isAnalyzing) await startPronunciationRecord();
  }

  async function sendToServer(audioBlob, localUrl) {
    try {
      const text = sanitizeTextForSubmit(refText);
      const base = getApiBase();

      const fd = new FormData();
      fd.append("audio", audioBlob, "clip.webm");
      fd.append("refText", text);
      fd.append("accent", accentUi === "en_br" ? "en_br" : "en_us");

      // ✅ HARD TIMEOUT so App Review never sees “infinite loading”
const controller = new AbortController();
const timeoutMs = 12000; // 12s (just enough for first-run, but prevents “indefinite”)
const t = setTimeout(() => controller.abort(), timeoutMs);

let r;
let json = {};
let psm = null; // ✅ IMPORTANT: available after the inner try/catch


try {
  r = await fetch(`${base}/api/analyze-speech`, {
    method: "POST",
    body: fd,
    signal: controller.signal,
  });

  // IMPORTANT: always clear timeout once we got a response
  clearTimeout(t);

  // Guard: server might return non-JSON on error
  const ct = r.headers?.get("content-type") || "";
  if (ct.includes("application/json")) {
    json = await r.json().catch(() => ({}));
  } else {
    const txt = await r.text().catch(() => "");
    json = txt ? { error: txt } : {};
  }

  if (!r.ok) throw new Error(json?.error || r.statusText || "Analyze failed");
  // ✅ PSM-style scoring (word-avg) for Practice my text
psm = psmSentenceScoreFromApi(json);

// overwrite the numbers the rest of this page uses
// (so pickFeedback + sfx thresholds match PSM)
json = { ...json, overall: psm.overall, pronunciation: psm.overall, overallAccuracy: psm.overall };

} catch (e) {
  clearTimeout(t);

  if (e?.name === "AbortError") {
    throw new Error("Analysis timed out. Please try again.");
  }
  throw e;
}

      // streak + confetti/sfx (kept)
      try {
        const s = updateStreak();
        setStreak(s);

const overall = Number(psm?.overall ?? json?.overall ?? 0);

        
                if (canPlaySfx) {
          if (overall >= 90) sfx.success({ strength: 2 });
          else if (overall >= 75) sfx.success({ strength: 1 });
        }

      } catch {}

const payload = {
  ...json,

  // ✅ force PSM score everywhere (top score, messages, etc.)
  overall: Number(psm?.overall ?? json?.overall ?? 0),
  pronunciation: Number(psm?.overall ?? json?.pronunciation ?? 0),
  overallAccuracy: Number(psm?.overall ?? json?.overallAccuracy ?? 0),

  // optional debug/use later
  psmWordScores: Array.isArray(psm?.wordScores) ? psm.wordScores : [],

  userAudioUrl: localUrl,
  userAudioBlob: audioBlob,
  refText: text,
  accent: accentUi,
  inlineMsg: pickFeedback({ ...json, overall: Number(psm?.overall ?? 0) }),
  createdAt: Date.now(),
};



      setResult(payload);

      setRefText(""); // ✅ clear input after successful recording/analyze
refreshSuggestions();


           try {
        sessionStorage.setItem(FEEDBACK_KEY, JSON.stringify(payload));
      } catch {}

    } catch (e) {
  // DEV: show real error
  if (!IS_PROD) {
    setErr(e?.message || String(e));
  } else {
    // PROD: silent mode / user-friendly
    setErr("Something went wrong. Try again.");
  }

  if (canPlaySfx) sfx.softFail();
} finally {
  setIsAnalyzing(false);
}
}
  /* ---------------- Layout constants ---------------- */
  const TABBAR_OFFSET = 84; // matcher tabbar-højde bedre
const SAFE_BOTTOM = "env(safe-area-inset-bottom, 0px)";
  const SEND_PURPLE = "#8B5CF6";

  // Light-mode tokens for this page (since you want “no dark mode”)
  const LIGHT_TEXT = "rgba(17,24,39,0.92)";
  const LIGHT_MUTED = "rgba(17,24,39,0.55)";
  const LIGHT_BORDER = "rgba(0,0,0,0.10)";
  const LIGHT_SHADOW = "0 10px 24px rgba(0,0,0,0.06)";
  const LIGHT_SURFACE = "#FFFFFF";
  const LIGHT_BAR = "rgba(247,248,250,0.92)";

  return (
    <div className="page" style={{ minHeight: "100vh", background: "#fff", color: LIGHT_TEXT }}>
      {/* Top header (hidden when expanded) */}
      <AnimatePresence initial={false}>
        {!isExpanded && (
          <motion.div
            className="mx-auto w-full"
            style={{ maxWidth: 720, padding: "14px 12px 8px" }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} // ✅ much slower
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div />
              <div
                style={{
                  textAlign: "center",
                  fontWeight: 900,
                  fontSize: 18,
                  color: LIGHT_TEXT,
                  pointerEvents: "none",
                  justifySelf: "center",
                }}
              >
                Practice my text
              </div>

              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Back"
                title="Back"
                style={{
                  justifySelf: "end",
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: LIGHT_SURFACE,
                  border: `1px solid ${LIGHT_BORDER}`,
                  boxShadow: LIGHT_SHADOW,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <ChevronDown className="h-5 w-5" style={{ color: LIGHT_TEXT }} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


       {/* Main content area */}
      <motion.div
        className="mx-auto w-full"
        style={{
          maxWidth: 720,
          padding: "18px 16px",
          paddingBottom: `calc(${TABBAR_OFFSET}px + 170px + ${SAFE_BOTTOM})`,
          overflowX: "hidden",
        }}
        animate={{ paddingTop: isExpanded ? 6 : 18 }} // ✅ expands upward into header space
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} // ✅ much slower
      >

        <div style={{ minHeight: "52vh", display: "grid", placeItems: "center", width: "100%", minWidth: 0 }}>
         {!result ? (
  <div style={{ display: "grid", gap: 8, justifyItems: "center", textAlign: "center" }}>
    <div style={{ color: LIGHT_MUTED, fontWeight: 800 }}>
      Type text below — then tap the purple button to record it.
    </div>
  </div>
) : (

     <div className="pf-embed-wrap" style={{ width: "100%", minWidth: 0 }}>
  <div className="pf-embed-inner">
    <PhonemeFeedback result={result} embed={true} hideBookmark={true} />
  </div>
</div>

          )}
        </div>

        {err ? (
          <div className="mt-3 text-[13px]" style={{ color: "#e5484d", textAlign: "center", fontWeight: 800 }}>
            {err}
          </div>
        ) : null}
      </motion.div>

      {/* Bottom composer */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: `calc(${TABBAR_OFFSET}px + ${SAFE_BOTTOM})`,
          zIndex: 40,
          padding: "10px 12px 14px",
          background: LIGHT_BAR,
          backdropFilter: "blur(10px)",
          boxShadow: "0 -8px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {/* Suggestion chips */}
          <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "6px 0px 10px", WebkitOverflowScrolling: "touch", maxWidth: "100%" }}>
            {suggestions.map((s) => (
  <button
      type="button"
    key={s}
    onClick={() => setRefText(s)}
    className="btn btn-ghost btn-sm"
    style={{
      borderRadius: 999,
      padding: "8px 12px",
      fontWeight: 900,
      whiteSpace: "nowrap",
      background: LIGHT_SURFACE,
      border: `1px solid ${LIGHT_BORDER}`,
      boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
      color: LIGHT_TEXT,
      maxWidth: "100%",
    }}
    title="Use suggestion"
  >
    {s}
  </button>
))}

          </div>

          {/* Input row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {/* Input */}
            <div
              style={{
                flex: 1,
                  minWidth: 0,              // ✅ VIGTIG
                background: LIGHT_SURFACE,
                border: `1px solid ${LIGHT_BORDER}`,
                boxShadow: LIGHT_SHADOW,
                borderRadius: 18,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
                         <input
  className="placeholder:text-[rgba(17,24,39,0.45)]"
  value={refText}
  onChange={(e) => setRefText(e.target.value)}
  onFocus={() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setIsExpanded(true);
  }}
  onBlur={() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => setIsExpanded(false), 220);
  }}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (showIntro) closeIntro();
      if (!isBusy && refText.trim()) togglePronunciationRecord();
    }
  }}
  onPaste={(e) => {
    e.preventDefault();
    const pasted = e.clipboardData?.getData("text") || "";
    setRefText(sanitizeTextForPaste(pasted));
  }}
  placeholder="Type text…"
  maxLength={220}
  style={{
    flex: 1,
    minWidth: 0,
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
  }}
  disabled={isBusy}
/>




              {/* Record button */}
              <button
                type="button"

              onClick={() => {
  if (showIntro) closeIntro();
  togglePronunciationRecord();
}}
                disabled={!refText.trim() || isAnalyzing}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
                title={isRecording ? "Stop" : "Record"}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: "none",
                  background: SEND_PURPLE,
                  display: "grid",
                  placeItems: "center",
                  cursor: !refText.trim() || isAnalyzing ? "not-allowed" : "pointer",
                  opacity: !refText.trim() || isAnalyzing ? 0.6 : 1,
                }}
              >
                {isRecording ? (
                  <StopCircle className="h-5 w-5" style={{ color: "white" }} />
                ) : (
                  <ArrowUp className="h-5 w-5" style={{ color: "white" }} />
                )}
              </button>
            </div>

            {/* Accent */}
            <div style={{ position: "relative", flex: "0 0 auto" }}>
              <select
                aria-label="Accent"
                value={accentUi}
                onChange={(e) => {
                  if (!isBusy) setAccentUi(e.target.value);
                }}
                disabled={isBusy}
                style={{
                  height: 46,
                  borderRadius: 16,
                  padding: "0 12px",
                  fontWeight: 900,
                  color: LIGHT_TEXT,
                  background: LIGHT_SURFACE,
                  border: `1px solid ${LIGHT_BORDER}`,
                  boxShadow: LIGHT_SHADOW,
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

              <ChevronDown
                className="h-4 w-4"
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: LIGHT_MUTED,
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>

          {/* status line */}
          <div
            style={{
              marginTop: 8,
              minHeight: 18,
              textAlign: "center",
              color: LIGHT_MUTED,
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {isRecording ? "Recording…" : isAnalyzing ? "Analyzing… (first run may take up to 15 seconds)" : " "}
          </div>
        </div>
      </div>
    </div>
  );
}