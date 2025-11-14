 // src/pages/Imitate.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Mic, StopCircle, RefreshCw, ChevronRight, RotateCcw, ArrowRight } from "lucide-react";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";
import { burstConfetti } from "../lib/celebrations.js";
import { updateStreak, readStreak } from "../lib/streak.js";

/* ---------------- Platform + API base ---------------- */
function isNative() { return !!(window?.Capacitor && window.Capacitor.isNativePlatform); }
function getApiBase() {
  const ls  = (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) || "";
  const env = (import.meta?.env && import.meta.env.VITE_API_BASE) || "";
  if (isNative()) {
    const base = (ls || env).replace(/\/+$/, "");
    if (!base) throw new Error("VITE_API_BASE (eller localStorage.apiBase) er ikke sat – krævet på iOS.");
    return base;
  }
  return (ls || env || window.location.origin).replace(/\/+$/, "");
}

/* ---------------- Tiny in-memory cache for sentences ---------------- */
const SENTENCE_CACHE = new Map();

async function safeFetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!res.ok) { const text = await res.text().catch(()=> ""); throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0,160)}`); }
  if (!ct.includes("application/json")) { const text = await res.text().catch(()=> ""); throw new Error(`Expected JSON, got ${ct || "unknown"} — ${text.slice(0,120)}`); }
  return res.json();
}
async function safeFetchAudio(url, options = {}) {
  const res = await fetch(url, options);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!res.ok) { const text = await res.text().catch(()=> ""); throw new Error(`TTS ${res.status} ${res.statusText} — ${text.slice(0,160)}`); }
  if (!ct.startsWith("audio/") && !ct.includes("application/octet-stream")) { const text = await res.text().catch(()=> ""); throw new Error(`Expected audio, got ${ct || "unknown"} — ${text.slice(0,120)}`); }
  return res.blob();
}

/* ---------------- Accent/Level ---------------- */
const ACCENTS = [
  { value: "en_us", ui: "🇺🇸 American English (US)" },
  { value: "en_br", ui: "🇬🇧 British English (UK)" },
];

export default function Imitate() {
  const [level, setLevel]   = useState("easy");
  const [accent, setAccent] = useState("en_us");
  const [sample, setSample] = useState({ text: "", voice: "en-US" });
  const sampleRef = useRef(sample);                  // <— tracks what’s actually rendered
  useEffect(() => { sampleRef.current = sample; }, [sample]);

  const [result, setResult] = useState(null);
  const [err, setErr]       = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [isLoadingSentence, setIsLoadingSentence] = useState(false);

  // streak
  const [streak, setStreak] = useState(() => readStreak());
  const [streakBanner, setStreakBanner] = useState("");

  // audio/recorder
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying]     = useState(false);
  const audioRef     = useRef(null);
  const mediaRecRef  = useRef(null);
  const chunksRef    = useRef([]);

  // user clip playback
  const [userAudioUrl, setUserAudioUrl] = useState("");
  const userPlayRef = useRef(null);

  // ---- one-at-a-time audio guard ----
  const playTokenRef = useRef(0);
  function stopAllAudio() {
    try { audioRef.current?.pause(); } catch {}
    try { userPlayRef.current?.pause(); } catch {}
    pendingAutoPlayRef.current = null;
  }

  // autoplay gate (gesture); now also stores seq for freshness
  const hasInteractedRef   = useRef(false);
  const pendingAutoPlayRef = useRef(null); // {text, accent, seq}

  const requestSeqRef = useRef(0);
  const lastNewRef = useRef(0);

  const hasValidSample = !!sample.text && sample.text !== "…";

  // Treat tab click as gesture + load first sentence
  useEffect(() => {
    const ts = Number(sessionStorage.getItem("ac_last_nav_click") || 0);
    if (Date.now() - ts < 1500) hasInteractedRef.current = true;
    if (navigator.userActivation?.hasBeenActive) hasInteractedRef.current = true;

    // On mount, ensure no stale audio plays
    stopAllAudio();

    setTimeout(() => loadSentence(level, accent), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First click/keypress as gesture
  useEffect(() => {
    const mark = () => {
      if (!hasInteractedRef.current) {
        hasInteractedRef.current = true;
        const p = pendingAutoPlayRef.current;
        if (p?.text && p.seq === requestSeqRef.current && sampleRef.current.text === p.text) {
          pendingAutoPlayRef.current = null;
          speakNative(p.text, p.accent);
        }
      }
    };
    window.addEventListener("pointerdown", mark, { once: true, capture: true });
    window.addEventListener("keydown",      mark, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", mark, { capture: true });
      window.removeEventListener("keydown",      mark, { capture: true });
    };
  }, []);

  /* ---------------- TTS ---------------- */
  async function speakNative(text, accentCode) {
    try {
      if (!text) return;

      // Hard guard: only speak if this exact text is what’s currently rendered
      if (sampleRef.current?.text !== text) return;

      if (!hasInteractedRef.current) {
        pendingAutoPlayRef.current = { text, accent: accentCode, seq: requestSeqRef.current };
        return;
      }

      const myToken = ++playTokenRef.current;
      stopAllAudio();

      setIsPlaying(true);
      const base = getApiBase();
      const qs = new URLSearchParams({ text, accent: accentCode }).toString();
      const audioBlob = await safeFetchAudio(`${base}/api/tts?${qs}`);
      const url  = URL.createObjectURL(audioBlob);

      if (myToken !== playTokenRef.current) { try { URL.revokeObjectURL(url); } catch {} return; }

      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => { if (myToken === playTokenRef.current) setIsPlaying(false); try { URL.revokeObjectURL(url); } catch {} };
      a.onerror = () => { if (myToken === playTokenRef.current) setIsPlaying(false); try { URL.revokeObjectURL(url); } catch {} };
      a.play().catch(() => {
        if (myToken === playTokenRef.current) {
          setIsPlaying(false);
          pendingAutoPlayRef.current = { text, accent: accentCode, seq: requestSeqRef.current };
        }
      });
    } catch (e) { setIsPlaying(false); setErr(e?.message || String(e)); }
  }
  function stopNative() { try { audioRef.current?.pause(); } catch {}; setIsPlaying(false); }

  // stop lyd ved navigation/skjul
  useEffect(() => {
    const onVis = () => { if (document.visibilityState !== "visible") stopAllAudio(); };
    window.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("visibilitychange", onVis); stopAllAudio(); };
  }, []);

  // cleanup blobs
  useEffect(() => {
    return () => {
      try { audioRef.current?.pause(); } catch {}
      try { userPlayRef.current?.pause(); } catch {}
      try { if (userAudioUrl?.startsWith("blob:")) URL.revokeObjectURL(userAudioUrl); } catch {}
    };
  }, [userAudioUrl]);

  /* --------------- Sentence: cache-first, then refresh (speak only fresh) --------------- */
  function cacheKey(levelArg, accentArg) { return `${levelArg}|${accentArg}`; }

  async function fetchSentenceFresh(levelArg, accentArg) {
    const base = getApiBase();
    const json = await safeFetchJSON(`${base}/api/generate-sentence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: levelArg, accent: accentArg }),
    });
    const value = {
      text: json.text,
      voice: json.voice || (accentArg === "en_br" ? "en-GB" : "en-US"),
    };
    SENTENCE_CACHE.set(cacheKey(levelArg, accentArg), value);
    return value;
  }

  async function loadSentence(levelArg = level, accentArg = accent) {
    try {
      setErr(""); setResult(null); setCelebrate(false);

      // Kill any stale audio/autoplay intent up-front
      stopAllAudio();
      pendingAutoPlayRef.current = null;

      setIsLoadingSentence(true);
      setSample((s) => ({ ...s, text: "…" }));
      const seq = ++requestSeqRef.current;

      // show cached immediately (but DO NOT speak)
      const cached = SENTENCE_CACHE.get(cacheKey(levelArg, accentArg));
      if (cached && seq === requestSeqRef.current) { setSample(cached); }

      const fresh = await fetchSentenceFresh(levelArg, accentArg);
      if (seq !== requestSeqRef.current) return;

      // Apply, then speak only if the applied text matches what we plan to speak
      setSample(fresh);
      setTimeout(() => {
        if (seq === requestSeqRef.current && sampleRef.current.text === fresh.text) {
          speakNative(fresh.text, accentArg);
        }
      }, 0);
    } catch (e) {
      setErr(e?.message || String(e));
      setSample({ text: "", voice: accentArg === "en_br" ? "en-GB" : "en-US" });
    } finally { setIsLoadingSentence(false); }
  }
  useEffect(() => { loadSentence(level, accent); }, [level, accent]);

  /* --------------- Recorder --------------- */
  function disposeRecorder() {
    try { mediaRecRef.current?.stream?.getTracks().forEach((t) => t.stop()); } catch {}
    mediaRecRef.current = null;
  }
  async function ensureMic() {
    disposeRecorder();
    const mime = (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))
      ? "audio/webm;codecs=opus" : "audio/webm";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec    = new MediaRecorder(stream, { mimeType: mime });
    chunksRef.current = [];
    rec.ondataavailable = (e) => e?.data && e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = handleStop;
    mediaRecRef.current = rec;
  }
  function handleStop() {
    setIsRecording(false);
    const blob = new Blob(chunksRef.current.slice(), { type: "audio/webm" });
    chunksRef.current = [];
    disposeRecorder();

    try { if (userAudioUrl && userAudioUrl.startsWith("blob:")) URL.revokeObjectURL(userAudioUrl); } catch {}
    const url = URL.createObjectURL(blob);
    setUserAudioUrl(url);

    sendToServer(blob, url);
  }
  async function startRecord() {
    if (!hasValidSample || isLoadingSentence) { setErr("Load a sentence first before recording."); return; }
    try {
      hasInteractedRef.current = true;
      setErr(""); setResult(null); setCelebrate(false);
      try { if (userAudioUrl?.startsWith("blob:")) URL.revokeObjectURL(userAudioUrl); } catch {}
      setUserAudioUrl("");

      await ensureMic();
      if (!mediaRecRef.current) throw new Error("Mic recorder not ready.");
      chunksRef.current = [];
      mediaRecRef.current.start();
      setIsRecording(true);
    } catch (e) { setErr("Microphone error: " + (e?.message || String(e))); setIsRecording(false); }
  }
  function stopRecord() { try { const r = mediaRecRef.current; if (r && r.state !== "inactive") r.stop(); } catch {} }

  function playUserRecording() {
    if (!userAudioUrl) return;
    try { userPlayRef.current?.pause(); } catch {}
    const a = new Audio(userAudioUrl);
    userPlayRef.current = a;
    a.onended = () => { try { userPlayRef.current = null; } catch {} };
    a.onerror = () => { try { userPlayRef.current = null; } catch {} };
    a.play().catch(() => {});
  }

  /* ======== SVG border like Record (dynamic box, single runner) ======== */
  const RADIUS = 28;
  const wrapRef = useRef(null);
  const [svgBox, setSvgBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const el = entries[0]?.target;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      setSvgBox({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  /* --------------- Render --------------- */
  return (
    <div className="page" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header + badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-[24px] sm:text-[26px] font-extrabold tracking-tight">
            <Link to="/imitate" className="page-title">Imitate the Native</Link>
          </h1>
          {streak.showBadge && <span className="ml-2 badge">{streak.badgeText}</span>}
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }}
          onClick={() => {
            const now = Date.now();
            if (now - lastNewRef.current < 400) return;
            lastNewRef.current = now;
            hasInteractedRef.current = true;
            loadSentence(level, accent);
          }}
          className="btn btn-ghost btn-sm"
        >
          <RefreshCw className="h-4 w-4" /> New
        </motion.button>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="relative brand-field" ref={wrapRef}>
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 160, damping: 26, mass: 0.9 }}
            className={`rounded-[28px] p-4 sm:p-5 ${celebrate ? "glow-highscore" : ""} panel relative z-[1]`}
            style={{ borderRadius: RADIUS }}
          >
            <div className="flex items-center gap-3 mb-3 text-sm flex-nowrap min-w-0" style={{ color: "var(--muted)" }}>
              <label className="whitespace-nowrap">Difficulty</label>
              <select value={level} onChange={(e)=> setLevel(e.target.value)} className="select-pill w-[130px] shrink-0">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              <span className="shrink-0">•</span>

              <label className="whitespace-nowrap">Accent</label>
              <select value={accent} onChange={(e)=> setAccent(e.target.value)} className="select-pill w-[220px] shrink-0">
                {ACCENTS.map(a => <option key={a.value} value={a.value}>{a.ui}</option>)}
              </select>
            </div>

            <div className="rounded-2xl px-4 py-3 mb-3 card-quiet">
              <div className="text-sm" style={{ color: "var(--muted)" }}>Target</div>
              <div className="text-lg font-semibold break-words" style={{ color: "var(--panel-text)" }}>
                {sample.text || "…"}
              </div>
            </div>

            <div className="flex items-stretch gap-2">
              <motion.button
                whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }}
                onClick={() => { hasInteractedRef.current = true; isPlaying ? stopNative() : speakNative(sample.text, accent); }}
                className="btn btn-ghost flex-1 h-12 text-base font-semibold"
                disabled={!hasValidSample || isLoadingSentence}
              >
                <Play className="h-5 w-5" /> {isPlaying ? "Playing..." : isLoadingSentence ? "Loading…" : "Play native"}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }}
                onClick={isRecording ? stopRecord : startRecord}
                className="btn btn-primary flex-1 h-12 text-base font-semibold"
                disabled={!hasValidSample || isLoadingSentence}
                aria-live="polite"
              >
                {isRecording ? <><StopCircle className="h-5 w-5" /> Stop</> : <><Mic className="h-5 w-5" /> Record</>}
              </motion.button>
            </div>

            <div className="text-sm mt-2 flex items-center gap-1" style={{ color: "var(--muted)" }}>
              <ChevronRight className="h-4 w-4" /> Listen → Record → Get feedback
            </div>

            <div className="mt-2 min-h-[22px]" aria-live="polite">
              <AnimatePresence>
                {isRecording && (
                  <motion.div key="rec" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}}
                    className="text-sm" style={{color:'var(--muted)'}}>
                    <span className="spinner" /> Recording in progress…
                  </motion.div>
                )}
                {isLoadingSentence && !isRecording && (
                  <motion.div key="load" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}}
                    className="text-sm" style={{color:'var(--muted)'}}>
                    <span className="spinner" /> Loading sample…
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* SVG rim */}
          <svg
            className="brand-orbit"
            width={svgBox.w}
            height={svgBox.h}
            viewBox={`0 0 ${svgBox.w} ${svgBox.h}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {(() => {
              const STROKE = 2;
              const inset = STROKE / 2;
              const w = Math.max(0, svgBox.w - STROKE);
              const h = Math.max(0, svgBox.h - STROKE);
              const rx = Math.max(0, RADIUS - inset);

              return (
                <>
                  <rect className="base"  x={inset} y={inset} width={w} height={h} rx={rx} ry={rx} shapeRendering="geometricPrecision" />
                  <rect className="dash"   x={inset} y={inset} width={w} height={h} rx={rx} ry={rx} pathLength="1" shapeRendering="geometricPrecision" />
                </>
              );
            })()}
          </svg>
        </div>

        {/* Error */}
        {err && <div className="max-w-3xl mx-auto mt-3 text-[13px]" style={{ color: "#e5484d" }}>{err}</div>}

        {/* Streak banner */}
        {streakBanner && (
          <div className="max-w-3xl mx-auto mt-3 rounded-xl px-4 py-3 text-center font-semibold"
               style={{border:"1px solid rgba(34,197,94,.35)", background:"rgba(34,197,94,.12)"}}>
            {streakBanner}
            <button className="ml-3 text-sm opacity-70" onClick={() => setStreakBanner("")}>✕</button>
          </div>
        )}

        {/* Feedback (unchanged) */}
        {result && (
          <motion.div
            className={`max-w-3xl mx-auto mt-3 rounded-2xl p-4 ${celebrate ? "glow-highscore" : ""}`}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--panel-border)" }}
          >
            <PhonemeFeedback result={result} />
            <div className="mt-4 flex items-center gap-2">
              <motion.button whileTap={{ scale: 0.98 }} className="btn btn-ghost btn-sm"
                onClick={() => { setResult(null); setCelebrate(false); speakNative(sample.text, accent); }}>
                <RotateCcw className="h-4 w-4" /> Try again
              </motion.button>
              <motion.button whileTap={{ scale: 0.98 }} className="btn btn-primary btn-sm"
                onClick={() => loadSentence(level, accent)}>
                Next phrase <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}