// src/pages/Record.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, StopCircle, X, Bookmark as BookmarkIcon } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import { burstConfetti } from "../lib/celebrations.js";
import { updateStreak, readStreak } from "../lib/streak.js";
import * as sfx from "../lib/sfx.js";

/* ------------ API base (web + native) ------------ */
function isNative() {
  return !!(window?.Capacitor && window.Capacitor.isNativePlatform);
}
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
const STATE_KEY = "ac_record_state_v1";

export default function Record() {
  const [lastUrl, setLastUrl] = useState(null);

  const [accentUi, setAccentUi] = useState("en_us");
  const [refText, setRefText]   = useState("");
  const [result, setResult]     = useState(null);
  const [err, setErr]           = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isBusy = isRecording || isAnalyzing;

  const [expanded, setExpanded]   = useState(true);
  const [inputActive, setInputActive] = useState(false);

  const mediaRecRef = useRef(null);
  const chunksRef   = useRef([]);
  const textAreaRef = useRef(null);

  const { settings, setSettings } = useSettings();

  // keep WebAudio volume synced with settings
  useEffect(() => {
    if (settings.soundEnabled) sfx.setVolume(settings.soundVolume ?? 0.6);
  }, [settings.soundEnabled, settings.soundVolume]);

  // --- STREAK + DAILY PROGRESS ---
  const [streak, setStreak] = useState(() => readStreak());

  const DAILY_TARGET = Math.max(1, Math.min(20, Number(settings.dailyGoal ?? 5)));
  const todayKey = () => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `ac_daily_${d.getFullYear()}-${m}-${day}`;
  };
  const getDaily = () => {
    try { return Number(localStorage.getItem(todayKey()) || 0); } catch { return 0; }
  };
  const [dailyCount, setDailyCount] = useState(getDaily());
  const incDaily = () => {
    try {
      const k = todayKey();
      const n = getDaily() + 1;
      localStorage.setItem(k, String(n));
      setDailyCount(n);
      return n;
    } catch { return 0; }
  };

  // --- VARIERET FEEDBACK ---
  function pickFeedback(json) {
    const overall = Number(json?.overall ?? json?.pronunciation ?? json?.overallAccuracy ?? 0);
    if (overall >= 95) {
      const lines = ["Unreal! 🔥", "Insane clarity! 🌟", "Flawless! 👑", "You’re on fire! 🚀"];
      return lines[Math.floor(Math.random() * lines.length)];
    }
    if (overall >= 90) {
      const lines = ["Awesome work! 💪", "Super clean! ✨", "You nailed it! ✅", "Crisp & clear! 🎯"];
      return lines[Math.floor(Math.random() * lines.length)];
    }
    if (overall >= 75) {
      const lines = ["Great progress — keep going! 🙌", "Nice! Focus the vowel length a touch. 🎧", "Solid! Try a slower pace. ⏱️"];
      return lines[Math.floor(Math.random() * lines.length)];
    }
    const lines = ["Good start — try emphasizing the stressed syllable. 🔊", "Try again a bit slower. 🐢", "Listen once more, then record. 👂"];
    return lines[Math.floor(Math.random() * lines.length)];
  }
  const [inlineMsg, setInlineMsg] = useState("");

    useEffect(() => {
    setAccentUi(settings.accentDefault || "en_us");

    // 1) hvis vi kommer fra Bookmarks med seed-tekst → den har prioritet
    const seed = sessionStorage.getItem("ac_bookmark_text");
    if (seed) {
      setRefText(seed);
      setExpanded(true);
      setInputActive(true);
      setResult(null);
      setInlineMsg("");
      setErr("");
      setTimeout(() => textAreaRef.current?.focus(), 0);
      sessionStorage.removeItem("ac_bookmark_text");
      return;
    }

    // 2) ellers prøv at gendanne tidligere state for Record-tab
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.refText === "string") setRefText(saved.refText);
        if (saved.result) setResult(saved.result);
        if (typeof saved.inlineMsg === "string") setInlineMsg(saved.inlineMsg);
        if (typeof saved.expanded === "boolean") setExpanded(saved.expanded);
        if (typeof saved.inputActive === "boolean")
          setInputActive(saved.inputActive);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      const payload = {
        refText,
        result,
        inlineMsg,
        expanded,
        inputActive,
      };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [refText, result, inlineMsg, expanded, inputActive]);


  function disposeRecorder() {
    try { mediaRecRef.current?.stream?.getTracks().forEach(t => t.stop()); } catch {}
    mediaRecRef.current = null;
  }

  async function ensureMic() {
  disposeRecorder();

  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error("Microphone not supported on this device.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Vælg en mimetype som faktisk er supporteret – eller lad browseren vælge
  let options = {};
  if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      options.mimeType = "audio/webm;codecs=opus";
    } else if (MediaRecorder.isTypeSupported("audio/webm")) {
      options.mimeType = "audio/webm";
    } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
      // typisk den der virker på iOS
      options.mimeType = "audio/mp4";
    } // ellers ingen mimeType → browseren vælger selv
  }

  let rec;
  try {
    rec = new MediaRecorder(stream, options);
  } catch (e) {
    // sidste fallback: ingen options overhovedet
    rec = new MediaRecorder(stream);
  }

  chunksRef.current = [];
  rec.ondataavailable = (e) => {
    if (e?.data && e.data.size > 0) chunksRef.current.push(e.data);
  };
  rec.onstop = handleStop;
  mediaRecRef.current = rec;
}


  function handleStop() {
  setIsRecording(false);

  const chunks = chunksRef.current.slice();
  chunksRef.current = [];

  const rec = mediaRecRef.current;

  disposeRecorder();
  try { if (lastUrl) URL.revokeObjectURL(lastUrl); } catch {}

  // Brug den type, optagelsen faktisk har
  const type = chunks[0]?.type || rec?.mimeType || "audio/webm";
  const blob = new Blob(chunks, { type });

  const localUrl = URL.createObjectURL(blob);
  setLastUrl(localUrl);
  setIsAnalyzing(true);
  sendToServer(blob, localUrl);
}


  async function startRecord() {
    if (!refText.trim()) { setErr("Please type a target word or phrase."); return; }
    try {
      setErr(""); setResult(null); setIsAnalyzing(false);
      await ensureMic();
      chunksRef.current = [];
      mediaRecRef.current.start();
      setIsRecording(true);
      if (settings.hapticsEnabled) sfx.hapticShort();
      if (settings.soundEnabled) sfx.warm();
    } catch (e) {
      setErr("Microphone error: " + (e?.message || String(e)));
      setIsRecording(false);
      if (settings.soundEnabled) sfx.softFail();
    }
  }

  function stopRecord() {
    try { if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop(); } catch {}
  }

  async function toggleRecording() {
    if (settings.soundEnabled) { sfx.warm(); sfx.setVolume(settings.soundVolume ?? 0.6); }
    if (isRecording) stopRecord();
    else if (!isAnalyzing) await startRecord();
  }

  async function sendToServer(audioBlob, localUrl) {
    try {
      const text = refText.trim();
      if (!text) { setErr("Please type a target word or phrase."); return; }

      const base = getApiBase();
      const fd = new FormData();
      fd.append("audio", audioBlob, "clip.webm");
      fd.append("refText", text);
      fd.append("accent", accentUi === "en_br" ? "en_br" : "en_us");

      const r = await fetch(`${base}/api/analyze-speech`, { method: "POST", body: fd });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json?.error || r.statusText || "Analyze failed");

      setResult({ ...json, userAudioUrl: localUrl });

      try {
        const s = updateStreak();
        setStreak(s);

        const before = dailyCount;
        const after  = incDaily();

        const overall = Number(json?.overall ?? 0);
        if (settings.soundEnabled) {
          if (overall >= 90) {
            sfx.success({ strength: 2 });
            if (settings.hapticsEnabled) sfx.hapticShort();
          } else if (overall >= 75) {
            sfx.success({ strength: 1 });
          }
        }

        const goal = Math.max(1, Math.min(50, Number(settings.dailyGoal ?? 5)));
        if (before < goal && after >= goal) {
          if (settings.soundEnabled) sfx.fanfare();
          burstConfetti();
        }
      } catch {}

      setInlineMsg(pickFeedback(json));
      setInputActive(false);
      setErr("");
      setExpanded(false);
    } catch (e) {
      setErr(e?.message || String(e));
      setResult(null);
      if (settings.soundEnabled) sfx.softFail();
    } finally {
      setIsAnalyzing(false);
    }
  }

  useEffect(() => () => { try { if (lastUrl) URL.revokeObjectURL(lastUrl); } catch {} }, [lastUrl]);

  const hasText   = refText.trim().length > 0;
  const analyzed  = !!result && !err;
  const taHeight  = analyzed ? 100 : (expanded ? 150 : 90);

  /* ========= Animated SVG border wiring ========= */
  const RADIUS = 22;                 // same rounded corner everywhere
  const wrapRef = useRef(null);
  const [svgBox, setSvgBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const el = entries[0]?.target;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      setSvgBox({ w: Math.round(width), h: Math.round(height) }); // avoid sub-pixel gaps
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  function handleTitleClick(e) {
    e.preventDefault();

    // ryd gemt state for denne tab
    try {
      sessionStorage.removeItem(STATE_KEY);
    } catch {}

    // nulstil local state
    setRefText("");
    setResult(null);
    setErr("");
    setInlineMsg("");
    setExpanded(true);
    setInputActive(false);
    setIsRecording(false);
    setIsAnalyzing(false);

    if (location.pathname === "/record") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/record");
    }
  }


  return (
    <div className="page">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-[24px] sm:text-[26px] font-extrabold tracking-tight">
            <Link
  to="/record"
  onClick={handleTitleClick}
  className="page-title"
>
  Practice My Text
</Link>

          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/bookmarks" className="btn btn-ghost h-9 inline-flex items-center gap-1.5" title="Bookmarks">
            <BookmarkIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Bookmarks</span>
          </Link>
        </div>
      </div>

      {/* Streak + Daily progress */}
      <div className="max-w-3xl mx-auto mb-3">
        <div className="flex items-center gap-2 mb-2">
          {streak?.showBadge && <span className="badge">{streak.badgeText}</span>}
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            Daily goal: {Math.min(dailyCount, DAILY_TARGET)} / {DAILY_TARGET}
          </span>
          <select
            className="select-pill text-xs"
            value={String(DAILY_TARGET)}
            onChange={(e) => {
              const v = Math.max(1, Math.min(20, Number(e.target.value || 5)));
              setSettings({ ...settings, dailyGoal: v });
            }}
            title="Set daily goal"
          >
            {[3, 5, 7, 10, 15, 20].map(n => (<option key={n} value={n}>{n}/day</option>))}
          </select>
        </div>
        <div className="progress">
          <span style={{ ['--pct']: `${Math.min(100, Math.round((dailyCount / DAILY_TARGET) * 100))}%` }} />
        </div>
      </div>

      {/* Input */}
<div className="max-w-3xl mx-auto">
  <div className="relative brand-field" ref={wrapRef}>
    <motion.textarea
      ref={textAreaRef}
      value={refText}
      onChange={(e) => setRefText(e.target.value)}
      onFocus={() => { setExpanded(true); setInputActive(true); }}
      placeholder="Tap to type..."
      animate={{ height: taHeight }}
      transition={{ type: "spring", stiffness: 140, damping: 22, mass: 0.9 }}
      className="brand-textarea w-full resize-none text-[15px] leading-6 p-3 pr-10 placeholder:text-white/40"
      style={{
        fontFamily: "'Poppins', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        fontWeight: 500,
        letterSpacing: ".2px",
        borderRadius: RADIUS,
      }}
      maxLength={1000}
    />

    {/* SVG overlay */}
    <svg
      className="brand-orbit"
      width={svgBox.w}
      height={svgBox.h}
      viewBox={`0 0 ${svgBox.w} ${svgBox.h}`}
      preserveAspectRatio="none"
    >
      {(() => {
        const STROKE = 2;
        const inset = STROKE / 2;
        const w = Math.max(0, Math.round(svgBox.w) - STROKE);
        const h = Math.max(0, Math.round(svgBox.h) - STROKE);
        const rx = Math.max(0, RADIUS - inset);

        return (
          <>
            <rect className="base" x={inset} y={inset} width={w} height={h} rx={rx} ry={rx} />
            <rect className="dash" x={inset} y={inset} width={w} height={h} rx={rx} ry={rx} pathLength="1" />
          </>
        );
      })()}
    </svg>

    <AnimatePresence>
      {hasText && !isBusy && (
        <motion.button
          key="clear-inside"
          initial={{ opacity: 0, scale: 0.8, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: -6 }}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => { setRefText(""); textAreaRef.current?.focus(); }}
          aria-label="Clear text"
          title="Clear"
          className="absolute top-2 right-2 z-10 grid place-items-center h-8 w-8 rounded-full bg-black/35 hover:bg-black/45 border border-white/10"
        >
          <X className="h-4 w-4 text-white/80" />
        </motion.button>
      )}
    </AnimatePresence>
  </div>


        {(!analyzed || inputActive) && (
          <div className="flex items-center justify-between px-1 py-2">
            <div style={{ color: 'var(--muted)' }} className="text-sm">{refText.length} / 1,000</div>
            <div className="w-9 h-9" />
          </div>
        )}

       {/* Accent (no visible text label) */}
{(!analyzed || inputActive) && (
  <div className="flex items-center mt-1">
    <select
      aria-label="Accent"
      value={accentUi}
      onChange={(e) => { if (!isBusy) setAccentUi(e.target.value); }}
      disabled={isBusy}
      className={[
        "select-pill text-sm",
        isBusy ? "opacity-60 cursor-not-allowed" : ""
      ].join(" ")}
      title={isBusy ? "Cannot change accent while recording/analyzing" : "Select accent"}
    >
      <option value="en_us">🇺🇸 American English (US)</option>
      <option value="en_br">🇬🇧 British English (UK)</option>
    </select>
  </div>
)}


        {/* Start/Stop */}
        <div className="mt-4">
          {(!analyzed || inputActive || isRecording) && (
            <motion.button
              onClick={toggleRecording}
              disabled={!refText.trim() || isAnalyzing}
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              className={[
                "btn btn-primary w-full font-semibold",
                isRecording ? "btn-pulse" : "",
                (!refText.trim() || isAnalyzing) ? "opacity-60 cursor-not-allowed" : ""
              ].join(" ")}
            >
              {isRecording
                ? (<><StopCircle className="h-5 w-5" /> Stop Recording</>)
                : (<><Mic className="h-5 w-5" /> {isAnalyzing ? "Analyzing…" : "Start Practicing"}</>)
              }
            </motion.button>
          )}

          {/* Inline status/feedback */}
          <div className="mt-2 min-h-[22px]" aria-live="polite">
            <AnimatePresence>
              {isRecording && (
                <motion.div key="rec" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="text-sm" style={{ color: 'var(--muted)' }}>
                  <span className="spinner" /> Recording in progress…
                </motion.div>
              )}
              {isAnalyzing && !isRecording && (
                <motion.div key="an" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="text-sm" style={{ color: 'var(--muted)' }}>
                  <span className="spinner" /> Analyzing…
                </motion.div>
              )}
              {!isAnalyzing && !isRecording && result && inlineMsg && (
                <motion.div key="done" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="text-sm" style={{ color: 'var(--muted)' }}>
                  {inlineMsg}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {err && <div className="max-w-3xl mx-auto mt-3 text-[13px]" style={{ color: '#e5484d' }}>{err}</div>}

      {result && (
        <div className="max-w-3xl mx-auto mt-3">
          <PhonemeFeedback result={result} />
        </div>
      )}
    </div>
  );
}