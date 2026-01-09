// src/pages/Record.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark as BookmarkIcon, Mic, StopCircle, X, Check, ChevronDown, ArrowUp } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import { updateStreak, readStreak } from "../lib/streak.js";
import * as sfx from "../lib/sfx.js";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";

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
  const location = useLocation();
  const { settings } = useSettings();

    // keep SFX volume synced with settings (0 = mute)
  useEffect(() => {
    sfx.setVolume(settings.volume ?? 0.6);
  }, [settings.volume]);
  const canPlaySfx = (settings.volume ?? 0) > 0.001;

  // streak (kept, but no daily goal UI)
  const [streak, setStreak] = useState(() => readStreak());

  // ---- state ----
  const [accentUi, setAccentUi] = useState(settings.accentDefault || "en_us");
  const [refText, setRefText] = useState("");
  const [err, setErr] = useState("");

  // pronunciation recording / analyzing
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isBusy = isRecording || isAnalyzing;

  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const [lastUrl, setLastUrl] = useState(null);

  // ✅ full feedback shown on SAME page
  const [result, setResult] = useState(null);

  // dictation UI (mic inside input)
  const [dictationMode, setDictationMode] = useState("idle"); // idle | listening | transcribing
  const [dictationText, setDictationText] = useState("");
  const recogRef = useRef(null);

  function sanitizeWord(raw) {
    const s = String(raw || "").trim();
    // take only the first token (no spaces)
    return s.split(/\s+/)[0] || "";
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
        if (typeof saved.refText === "string") setRefText(sanitizeWord(saved.refText));
        if (typeof saved.accentUi === "string") setAccentUi(saved.accentUi);
      }
    } catch {}

    

    // seedText via route state (bookmarks handoff)
    const seedFromState = String(location?.state?.seedText || "").trim();
    if (seedFromState) {
      setRefText(sanitizeWord(seedFromState));
      setErr("");
          // ✅ Always start fresh when entering Record tab
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

    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // persist state
  useEffect(() => {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ refText, accentUi }));
    } catch {}
  }, [refText, accentUi]);

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
      setErr("Microphone error: " + (e?.message || String(e)));
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
      const text = refText.trim();
      const base = getApiBase();

      const fd = new FormData();
      fd.append("audio", audioBlob, "clip.webm");
      fd.append("refText", text);
      fd.append("accent", accentUi === "en_br" ? "en_br" : "en_us");

      const r = await fetch(`${base}/api/analyze-speech`, { method: "POST", body: fd });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json?.error || r.statusText || "Analyze failed");

      // streak + confetti/sfx (kept)
      try {
        const s = updateStreak();
        setStreak(s);

        const overall = Number(json?.overall ?? json?.overallAccuracy ?? json?.pronunciation ?? 0);
        
                if (canPlaySfx) {
          if (overall >= 90) sfx.success({ strength: 2 });
          else if (overall >= 75) sfx.success({ strength: 1 });
        }

      } catch {}

      const payload = {
        ...json,
        userAudioUrl: localUrl,
        refText: text,
        accent: accentUi,
        inlineMsg: pickFeedback(json),
        createdAt: Date.now(),
      };

      setResult(payload);

      setRefText(""); // ✅ clear input after successful recording/analyze
refreshSuggestions();


           try {
        sessionStorage.setItem(FEEDBACK_KEY, JSON.stringify(payload));
      } catch {}

    } catch (e) {
      setErr(e?.message || String(e));
      if (canPlaySfx) sfx.softFail();
    } finally {
      setIsAnalyzing(false);
    }
  }

  /* ---------------- Dictation (mic inside input) ---------------- */
  function getSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    return SR ? new SR() : null;
  }

  function startDictation() {
    setErr("");
    const rec = getSpeechRecognition();
    if (!rec) {
      setErr("Dictation is not supported in this browser.");
      return;
    }
    if (dictationMode !== "idle") return;

    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = accentUi === "en_br" ? "en-GB" : "en-US";

    setDictationText("");
    setDictationMode("listening");

    rec.onresult = (event) => {
      let full = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r?.[0]?.transcript || "";
        full += t;
      }
      setDictationText(full.trim());
    };

    rec.onerror = (e) => {
      setDictationMode("idle");
      setErr(e?.error ? `Dictation error: ${e.error}` : "Dictation error");
      try {
        rec.stop();
      } catch {}
      recogRef.current = null;
    };

    rec.onend = () => {
      if (dictationMode !== "transcribing") setDictationMode("idle");
    };

    recogRef.current = rec;

    try {
      rec.start();
    } catch (e) {
      setDictationMode("idle");
      setErr(e?.message || "Could not start dictation.");
      recogRef.current = null;
    }
  }

  function cancelDictation() {
    try {
      recogRef.current?.stop?.();
    } catch {}
    recogRef.current = null;
    setDictationMode("idle");
    setDictationText("");
  }

  function acceptDictation() {
    try {
      recogRef.current?.stop?.();
    } catch {}
    recogRef.current = null;

    setDictationMode("transcribing");

    setTimeout(() => {
      const t = String(dictationText || "").trim();
      if (t) {
        setRefText(sanitizeWord(t));

      }
      setDictationText("");
      setDictationMode("idle");
    }, 700);
  }

  /* ---------------- Layout constants ---------------- */
  const TABBAR_OFFSET = 64;
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
      {/* Top header */}
      <div className="mx-auto w-full" style={{ maxWidth: 720, padding: "14px 12px 8px" }}>
        <div style={{
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
  Practice a Word
</div>

          <Link
  to="/bookmarks"
  className="pw-bookmarksBtn"
  title="Bookmarks"
  style={{
    justifySelf: "end",
    marginRight: -6,      // ✅ ryk lidt mere mod højre
  }}
>
  <BookmarkIcon className="pw-bookmarksIcon" />
</Link>



        </div>
      </div>

      {/* Main content area */}
      <div className="mx-auto w-full" style={{ maxWidth: 720, padding: "18px 16px", paddingBottom: `calc(${TABBAR_OFFSET}px + 170px)` }}>
        <div style={{ minHeight: "52vh", display: "grid", placeItems: "center" }}>
         {!result ? (
  <div style={{ display: "grid", gap: 8, justifyItems: "center", textAlign: "center" }}>
    <div style={{ color: LIGHT_MUTED, fontWeight: 800 }}>
      Type something below — then tap the purple button to record it.
    </div>
  </div>
) : (

            <div style={{ width: "min(720px, 92vw)" }}>
              <PhonemeFeedback
  result={result}
  embed={true}
  hideBookmark={true}
/>

            </div>
          )}
        </div>

        {err ? (
          <div className="mt-3 text-[13px]" style={{ color: "#e5484d", textAlign: "center", fontWeight: 800 }}>
            {err}
          </div>
        ) : null}
      </div>

      {/* Dictation bar (keep dark overlay – OK) */}
      <AnimatePresence>
        {dictationMode !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            style={{
              position: "fixed",
              left: "50%",
              transform: "translateX(-50%)",
              bottom: `calc(${TABBAR_OFFSET}px + 92px)`,
              width: "min(720px, calc(100vw - 24px))",
              zIndex: 50,
            }}
          >
            <div
              style={{
                background: "rgba(0,0,0,0.78)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 18,
                padding: "12px 12px",
                display: "grid",
                gridTemplateColumns: "44px 1fr 44px",
                alignItems: "center",
                gap: 10,
                boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
              }}
            >
              <button
                onClick={cancelDictation}
                className="grid place-items-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(255,255,255,0.10)",
                  color: "white",
                  cursor: "pointer",
                }}
                aria-label="Cancel dictation"
                title="Cancel"
              >
                <X className="h-5 w-5" />
              </button>

              <div style={{ textAlign: "center", color: "white", fontWeight: 900 }}>
                {dictationMode === "listening" ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 26, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.20)", position: "relative", overflow: "hidden" }}>
                      <motion.div
                        initial={{ x: -18 }}
                        animate={{ x: 34 }}
                        transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                        style={{ width: 18, height: "100%", borderRadius: 999, background: "rgba(255,255,255,0.75)" }}
                      />
                    </div>
                    Listening…
                  </div>
                ) : (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        border: "3px solid rgba(255,255,255,0.22)",
                        borderTopColor: "rgba(255,255,255,0.80)",
                      }}
                    />
                    Transcribing…
                  </div>
                )}

                {dictationMode === "listening" && dictationText ? (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.70)" }}>
                    {dictationText}
                  </div>
                ) : null}
              </div>

              <button
                onClick={acceptDictation}
                disabled={dictationMode !== "listening"}
                className="grid place-items-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: "none",
                  background: dictationMode === "listening" ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.08)",
                  color: "white",
                  cursor: dictationMode === "listening" ? "pointer" : "not-allowed",
                  opacity: dictationMode === "listening" ? 1 : 0.6,
                }}
                aria-label="Done dictation"
                title="Done"
              >
                <Check className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom composer */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: `calc(${TABBAR_OFFSET}px)`,
          zIndex: 40,
          padding: "10px 12px 14px",
          background: LIGHT_BAR,
          backdropFilter: "blur(10px)",
          boxShadow: "0 -8px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {/* Suggestion chips */}
          <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "6px 2px 10px", WebkitOverflowScrolling: "touch" }}>
            {suggestions.map((s) => (
  <button
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
    }}
    title="Use suggestion"
  >
    {s}
  </button>
))}

          </div>

          {/* Input row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Input */}
            <div
              style={{
                flex: 1,
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
                onChange={(e) => setRefText(sanitizeWord(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === " ") e.preventDefault(); // block space
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData?.getData("text") || "";
                  setRefText(sanitizeWord(pasted));
                }}
                placeholder="Type a word…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: LIGHT_TEXT,
                  fontWeight: 800,
                  fontSize: 16,
                }}
                maxLength={64}
                disabled={isBusy}
              />


              {/* Dictation mic */}
              <button
                onClick={startDictation}
                disabled={dictationMode !== "idle" || isBusy}
                title="Dictate"
                aria-label="Dictate"
                style={{
                  border: "none",
                  background: "transparent",
                  color: LIGHT_MUTED,
                  display: "grid",
                  placeItems: "center",
                  cursor: dictationMode === "idle" && !isBusy ? "pointer" : "not-allowed",
                  opacity: dictationMode === "idle" && !isBusy ? 1 : 0.5,
                  padding: 0,
                }}
              >
                <Mic className="h-5 w-5" />
              </button>

              {/* Record button */}
              <button
                onClick={togglePronunciationRecord}
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
            <div style={{ position: "relative" }}>
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
            {isRecording ? "Recording…" : isAnalyzing ? "Analyzing…" : " "}
          </div>
        </div>
      </div>
    </div>
  );
}
