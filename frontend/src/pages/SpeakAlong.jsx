// src/pages/SpeakAlong.jsx
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Mic, StopCircle, RefreshCw, ChevronRight, RotateCcw, ArrowRight } from "lucide-react";
import { burstConfetti } from "../lib/celebrations.js";
import { playAudio, stopAudio } from "../lib/audio-manager";

/* ---- API base helper ---- */
function isNative() { return !!(window?.Capacitor && window.Capacitor.isNativePlatform); }
function getApiBase() {
  const ls = (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) || "";
  const env = (import.meta?.env && import.meta.env.VITE_API_BASE) || "";
  if (isNative()) {
    const base = (ls || env).replace(/\/+$/, "");
    if (!base) throw new Error("VITE_API_BASE (eller localStorage.apiBase) er ikke sat – krævet på iOS.");
    return base;
  }
  return (ls || env || window.location.origin).replace(/\/+$/, "");
}

/* ---- helpers ---- */
async function safeJSON(url, opts = {}, timeoutMs = 12000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ac.signal });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok) {
      const text = await res.text().catch(()=> "");
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0,140)}`);
    }
    if (!ct.includes("application/json")) {
      const text = await res.text().catch(()=> "");
      throw new Error(`Expected JSON, got ${ct || "unknown"}: ${text.slice(0,120)}`);
    }
    return res.json();
  } finally { clearTimeout(t); }
}

export default function SpeakAlong() {
  // basic state
  const [level, setLevel] = useState("easy");
  const [accent, setAccent] = useState("en_us");
  const [text, setText] = useState("…");
  const [err, setErr] = useState("");

  // audio
  const [isPlaying, setIsPlaying] = useState(false);
  const audioElRef = useRef(null);
  const audioBlobUrlRef = useRef("");

  // record
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);

  // scoring
  const nativeEnvelope = useRef([]);
  const userEnvelope = useRef([]);
  const [score, setScore] = useState(null);
  const [celebrate, setCelebrate] = useState(false);

  const requestSeqRef = useRef(0);

  // ==== orbit-ring måling (samme princip som Imitate) ====
  const wrapRef = useRef(null);
  const [svgBox, setSvgBox] = useState({ w: 0, h: 0 });
  const RADIUS = 22; // matcher panelens rounded-[22px]

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
  // =======================================================

  /* lifecycle */
  useEffect(() => {
    const onVis = () => { if (document.hidden) { stopAudio(); stopNativeEl(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stopAudio(); stopNativeEl(); revokeBlobUrl();
    };
  }, []);

  useEffect(() => { loadSentence(level, accent); /* eslint-disable-next-line */ }, []);

  /* sentence + TTS */
  async function loadSentence(levelArg = level, accentArg = accent) {
    const mySeq = ++requestSeqRef.current;
    try {
      setErr(""); setScore(null); setCelebrate(false);
      setText("…");

      const base = getApiBase();
      const gj = await safeJSON(`${base}/api/generate-sentence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: levelArg, accent: accentArg }),
      });

      if (mySeq !== requestSeqRef.current) return;
      const phrase = String(gj?.text || "").trim();
      if (!phrase) throw new Error("Empty sentence from API.");
      setText(phrase);

      await prefetchTTS(phrase, accentArg, mySeq);
    } catch (e) {
      if (mySeq !== requestSeqRef.current) return;
      setErr(e?.message || String(e));
      setText("");
    }
  }

  async function prefetchTTS(phrase, accentArg, seqAtCall) {
    if (!phrase) return;
    try {
      const base = getApiBase();
      const qs = new URLSearchParams({ text: phrase, accent: accentArg }).toString();
      const rt = await fetch(`${base}/api/tts?${qs}`);
      if (!rt.ok) throw new Error(`TTS failed: ${rt.status}`);
      const blob = await rt.blob();

      if (seqAtCall !== requestSeqRef.current) return;
      revokeBlobUrl();
      const url = URL.createObjectURL(blob);
      audioBlobUrlRef.current = url;

      // envelope for timing calc
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const arr = await blob.arrayBuffer();
      const buf = await ac.decodeAudioData(arr);
      nativeEnvelope.current = computeEnvelope(buf);

      stopNativeEl();
      const a = new Audio(url);
      audioElRef.current = a;
      a.onended = () => setIsPlaying(false);
      a.onerror = () => setIsPlaying(false);
    } catch (e) {
      if (seqAtCall !== requestSeqRef.current) return;
      setErr(e?.message || String(e));
    }
  }

  function revokeBlobUrl() {
    try { if (audioBlobUrlRef.current?.startsWith("blob:")) URL.revokeObjectURL(audioBlobUrlRef.current); } catch {}
    audioBlobUrlRef.current = "";
  }
  function stopNativeEl() {
    try { audioElRef.current?.pause(); } catch {}
    audioElRef.current = null;
    setIsPlaying(false);
  }
  function playNative() {
    const a = audioElRef.current;
    if (!a) return;
    stopAudio();
    setIsPlaying(true);
    a.currentTime = 0;
    a.play().catch(() => setIsPlaying(false));
  }

  /* recorder + analysis */
  function disposeRecorder() {
    try { mediaRecRef.current?.stream?.getTracks().forEach((t) => t.stop()); } catch {}
    mediaRecRef.current = null;
  }
  async function ensureMic() {
    disposeRecorder();
    const mime = (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))
      ? "audio/webm;codecs=opus" : "audio/webm";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: mime });
    chunksRef.current = [];
    rec.ondataavailable = (e) => e?.data && e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = handleStop;
    mediaRecRef.current = rec;
  }
  async function handleStop() {
    setIsRecording(false);
    const blob = new Blob(chunksRef.current.slice(), { type: "audio/webm" });
    chunksRef.current = [];
    try {
      if (blob.size < 9000) return setErr("We didn't capture enough audio — try again closer to the mic.");
      const { silent, reason } = await isMostlySilence(blob);
      if (silent) return setErr(reason || "We couldn't detect clear speech.");
      analyzeShadow(blob);
    } catch (e) { setErr(e?.message || String(e)); }
  }
  function stopRecord() {
    try { if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop(); } catch {}
  }
  async function playAndShadow() {
    if (!audioElRef.current || !text) return;
    setScore(null); setCelebrate(false);
    try {
      await ensureMic();
      chunksRef.current = [];
      mediaRecRef.current.start();
      setIsRecording(true);

      stopAudio();
      setIsPlaying(true);
      audioElRef.current.currentTime = 0;
      audioElRef.current.play().catch(() => setIsPlaying(false));

      const nativeMs = (nativeEnvelope.current?.length || 40) * 50;
      setTimeout(() => stopRecord(), Math.max(1200, nativeMs + 300));
    } catch (e) {
      setErr("Microphone error: " + (e?.message || String(e)));
      setIsRecording(false);
    }
  }

  function computeEnvelope(audioBuffer, frameMs = 50) {
    const sr = audioBuffer.sampleRate;
    const ch = audioBuffer.numberOfChannels;
    const data = new Float32Array(audioBuffer.length);
    for (let c = 0; c < ch; c++) {
      const d = audioBuffer.getChannelData(c);
      for (let i = 0; i < d.length; i++) data[i] += d[i] / ch;
    }
    const frame = Math.round((frameMs / 1000) * sr);
    const env = [];
    for (let i = 0; i < data.length; i += frame) {
      let sum = 0;
      const end = Math.min(i + frame, data.length);
      for (let j = i; j < end; j++) sum += data[j] * data[j];
      const rms = Math.sqrt(sum / (end - i || 1));
      env.push(rms);
    }
    const max = Math.max(...env, 1e-6);
    return env.map((x) => x / max);
  }
  function crossCorrelation(a, b, maxLagFrames = 30) {
    let bestCorr = -1, bestLag = 0;
    for (let lag = -maxLagFrames; lag <= maxLagFrames; lag++) {
      let sxy = 0, sx2 = 0, sy2 = 0;
      for (let i = 0; i < a.length; i++) {
        const j = i + lag;
        if (j < 0 || j >= b.length) continue;
        const x = a[i], y = b[j];
        sxy += x * y; sx2 += x * x; sy2 += y * y;
      }
      const denom = Math.sqrt(sx2 * sy2) || 1e-6;
      const c = sxy / denom;
      if (c > bestCorr) { bestCorr = c; bestLag = lag; }
    }
    return { bestLag, bestCorr };
  }
  async function analyzeShadow(userBlob) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const arr = await userBlob.arrayBuffer();
      const ubuf = await ac.decodeAudioData(arr);
      const userEnv = computeEnvelope(ubuf);
      userEnvelope.current = userEnv;

      const { bestLag, bestCorr } = crossCorrelation(nativeEnvelope.current, userEnv, 30);
      const nd = (nativeEnvelope.current.length * 50) / 1000;
      const ud = ubuf.duration || 1;
      const durMatch = Math.max(0, 1 - Math.abs(ud - nd) / Math.max(nd, ud));
      const timing01 = Math.max(0, Math.min(1, 0.75 * bestCorr + 0.25 * durMatch));
      const s = {
        timing: Math.round(timing01 * 100),
        latencyMs: bestLag * 50,
        durationMatch: Math.round(durMatch * 100),
        nativeDur: Math.round(nd * 100) / 100,
        userDur: Math.round(ud * 100) / 100,
      };
      setScore(s); setErr("");
      if (s.timing >= 90) { setCelebrate(true); burstConfetti(); } else { setCelebrate(false); }
    } catch (e) { setErr(e?.message || String(e)); setScore(null); setCelebrate(false); }
  }

  async function isMostlySilence(audioBlob) {
    const arrBuf = await audioBlob.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ctx.decodeAudioData(arrBuf);
    const sr = buf.sampleRate, ch = buf.numberOfChannels, len = buf.length;
    const dur = len / sr;
    if (dur < 0.6) return { silent: true, reason: `Recording too short (${dur.toFixed(2)}s)` };

    const mono = new Float32Array(len);
    for (let c = 0; c < ch; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += d[i] / ch;
    }
    const frame = Math.round((20 / 1000) * sr);
    let silentFrames = 0;
    for (let i = 0; i < len; i += frame) {
      let sum = 0;
      const end = Math.min(i + frame, len);
      for (let j = i; j < end; j++) sum += mono[j] * mono[j];
      const rms = Math.sqrt(sum / (end - i || 1));
      if (rms < 0.015) silentFrames++;
    }
    const frac = silentFrames / (len / frame);
    return { silent: frac >= 0.8, reason: frac >= 0.8 ? "Mostly silence detected" : "" };
  }

  /* ========== UI ========== */
  return (
    <div className="page" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[26px] font-extrabold tracking-tight page-title">Speak Along</h1>
        <div className="flex items-center gap-2">
          <select
            value={level}
            onChange={(e) => { const v = e.target.value; setLevel(v); stopAudio(); stopNativeEl(); loadSentence(v, accent); }}
            className="select-pill text-sm"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select
            value={accent}
            onChange={(e) => { const v = e.target.value; setAccent(v); stopAudio(); stopNativeEl(); loadSentence(level, v); }}
            className="select-pill text-sm"
          >
            <option value="en_us">🇺🇸 American English (US)</option>
            <option value="en_br">🇬🇧 British English (UK)</option>
          </select>
          <motion.button
            whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }}
            onClick={() => { stopAudio(); stopNativeEl(); loadSentence(level, accent); }}
            className="btn btn-ghost btn-sm"
          >
            <RefreshCw className="h-4 w-4" /> New
          </motion.button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto relative brand-field imitate-ring" ref={wrapRef}>
        {/* Panelen med samme border-radius som RADIUS */}
        <div className="panel rounded-[22px] p-4 sm:p-5 relative z-[1]" style={{ borderRadius: RADIUS }}>
          {/* Target */}
          <div className="rounded-xl px-4 py-3 mb-3 card-quiet">
            <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>Target</div>
            <div className="text-xl sm:text-2xl font-semibold leading-snug" style={{ color: "var(--panel-text)" }}>
              {text || (err ? "Could not load — press New" : "…")}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-stretch gap-2">
            <motion.button
              whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }}
              onClick={playNative}
              className="btn btn-ghost flex-1 h-12 text-base font-semibold"
              disabled={!text}
            >
              <Play className="h-5 w-5" />
              <span className="truncate">{isPlaying ? "Playing..." : "Play native"}</span>
            </motion.button>

            {!isRecording ? (
              <motion.button
                whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }}
                onClick={playAndShadow}
                className="btn btn-primary flex-1 h-12 text-base font-semibold"
                disabled={!text}
              >
                <Mic className="h-5 w-5" />
                Shadow now
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={stopRecord}
                className="btn btn-ghost h-12 text-base font-semibold"
              >
                <StopCircle className="h-5 w-5" /> Stop
              </motion.button>
            )}
          </div>

          {/* Hint / status */}
          <div className="text-sm mt-2 flex items-center gap-1 min-h-[22px]" style={{ color: "var(--muted)" }}>
            <ChevronRight className="h-4 w-4" />
            {!isRecording ? "Click Play, then Shadow now — we’ll score your timing" : (
              <span className="flex items-center gap-2"><span className="spinner" /> Recording…</span>
            )}
          </div>

          {/* Score (kun når den findes) */}
          {score && (
            <div className="mt-4 card-quiet rounded-xl p-4">
              <div className="text-xs uppercase mb-1" style={{ color: "var(--muted)" }}>Timing result</div>
              <div className={`text-4xl font-extrabold ${celebrate ? "text-glow" : ""}`} style={{ color: "#93C5FD" }}>
                {score.timing}%</div>
              <div className="grid grid-cols-2 gap-2 mt-2" style={{ color: "var(--panel-text)" }}>
                <div>Latency: <span className="font-semibold">{score.latencyMs} ms</span></div>
                <div>Duration match: <span className="font-semibold">{score.durationMatch}%</span></div>
                <div>Native: <span className="font-semibold">{score.nativeDur}s</span></div>
                <div>You: <span className="font-semibold">{score.userDur}s</span></div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <motion.button whileTap={{ scale: 0.98 }} className="btn btn-ghost btn-sm"
                  onClick={() => { setScore(null); setCelebrate(false); playAndShadow(); }}>
                  <RotateCcw className="h-4 w-4" /> Try again
                </motion.button>
                <motion.button whileTap={{ scale: 0.98 }} className="btn btn-primary btn-sm"
                  onClick={() => { stopAudio(); stopNativeEl(); loadSentence(level, accent); }}>
                  Next phrase <ArrowRight className="h-4 w-4" />
                </motion.button>
              </div>
            </div>
          )}

          {err && <div className="mt-3 text-[13px]" style={{ color: "#e5484d" }}>{err}</div>}
        </div>

        {/* === SVG orbit-kant (samme som Imitate) === */}
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
                <rect className="base" x={inset} y={inset} width={w} height={h} rx={rx} ry={rx} />
                <rect className="dash"  x={inset} y={inset} width={w} height={h} rx={rx} ry={rx} pathLength="1" />
              </>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
