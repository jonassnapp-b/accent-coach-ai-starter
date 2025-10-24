// src/pages/Shadowing.jsx
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Mic, StopCircle, RefreshCw, ChevronRight } from "lucide-react";

const PRIMARY = "#2196F3";
const ACCENT  = "#FF9800";

export default function Shadowing() {
  // collapsed landing
  const [started, setStarted] = useState(false);

  // controls
  const [level, setLevel]   = useState("easy");
  const [accent, setAccent] = useState("en_us");

  // sample + audio
  const [text, setText] = useState("");
  const [voiceLabel, setVoiceLabel] = useState("en-US");
  const audioRef  = useRef(null);     // native audio element
  const nativeBuf = useRef(null);     // AudioBuffer of native (for analysis)
  const [isPlaying, setIsPlaying] = useState(false);

  // recorder
  const mediaRecRef = useRef(null);
  const chunksRef   = useRef([]);
  const [isRecording, setIsRecording] = useState(false);

  // UI / results
  const [err, setErr] = useState("");
  const [score, setScore] = useState(null);  // { timing, latencyMs, durationMatch, nativeDur, userDur }
  const nativeEnvelope = useRef([]);
  const userEnvelope   = useRef([]);

  /* ---------------- Silence/quality gate ---------------- */
  async function isMostlySilence(
    audioBlob,
    { minDurationSec = 0.6, frameMs = 20, rmsThresh = 0.015, silentFrac = 0.8 } = {}
  ) {
    const arrBuf = await audioBlob.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ctx.decodeAudioData(arrBuf);
    const sr = buf.sampleRate;
    const ch = buf.numberOfChannels;
    const len = buf.length;
    const dur = len / sr;

    if (dur < minDurationSec) {
      return { silent: true, reason: `Recording too short (${dur.toFixed(2)}s)` };
    }

    // mix to mono
    const mono = new Float32Array(len);
    for (let c = 0; c < ch; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += d[i] / ch;
    }

    // windowed RMS
    const frame = Math.max(1, Math.round((frameMs / 1000) * sr));
    let silentFrames = 0, total = 0;
    for (let i = 0; i < len; i += frame) {
      let sum = 0, n = 0;
      for (let j = i; j < Math.min(i + frame, len); j++) { const v = mono[j]; sum += v * v; n++; }
      const rms = Math.sqrt(sum / Math.max(1, n));
      if (rms < rmsThresh) silentFrames++;
      total++;
    }
    const frac = total ? (silentFrames / total) : 1;
    return { silent: frac >= silentFrac, reason: frac >= silentFrac ? "Mostly silence detected" : "" };
  }

  // --- helpers: audio load + play ---
  async function loadSentence(levelArg = level, accentArg = accent, autoPlay = false) { // ← autoplay default = false
    try {
      setErr("");
      setScore(null);
      setText("…");
      // 1) sentence
      const rg = await fetch("/api/generate-sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: levelArg, accent: accentArg })
      });
      const rawG = await rg.text();
      const gj = JSON.parse(rawG);
      if (!rg.ok) throw new Error(gj?.error || `HTTP ${rg.status}`);
      setText(gj.text || "");
      setVoiceLabel(gj.voice || (accentArg === "en_br" ? "en-GB" : "en-US"));

      // 2) tts
      const qs = new URLSearchParams({ text: gj.text || "", accent: accentArg }).toString();
      const rt = await fetch(`/api/tts?${qs}`);
      if (!rt.ok) {
        const t = await rt.text();
        throw new Error(`TTS failed: ${rt.status} ${t || ""}`);
      }
      const blob = await rt.blob();
      const url  = URL.createObjectURL(blob);

      // 3) prepare audio element
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
        if (audioRef.current.src?.startsWith("blob:")) {
          try { URL.revokeObjectURL(audioRef.current.src); } catch {}
        }
      }
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => { setIsPlaying(false); };
      a.onerror = () => { setIsPlaying(false); };

      // 4) decode to AudioBuffer for analysis + envelope
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const arrbuf = await blob.arrayBuffer();
      const buf = await ac.decodeAudioData(arrbuf);
      nativeBuf.current = buf;
      nativeEnvelope.current = computeEnvelope(buf);

      if (autoPlay) playAndShadow(); // vi kalder kun hvis eksplicit
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
      setText("");
    }
  }

  function playNative() {
    const a = audioRef.current;
    if (!a) return;
    setIsPlaying(true);
    a.currentTime = 0;
    a.play().catch(() => setIsPlaying(false));
  }

  // --- recorder lifecycle ---
  function disposeRecorder() {
    try {
      mediaRecRef.current?.stream?.getTracks().forEach(t => t.stop());
    } catch {}
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
    disposeRecorder();

    try {
      // hurtig filstørrelses-gate
      if (blob.size < 9000) {
        setErr("We didn't capture enough audio — try again closer to the mic.");
        setScore(null);
        return;
      }
      // WebAudio stilletjek
      const { silent, reason } = await isMostlySilence(blob);
      if (silent) {
        setErr(reason || "We couldn't detect clear speech. Try again a bit louder and closer to the mic.");
        setScore(null);
        return;
      }
      // alt ok → score
      analyzeShadow(blob);
    } catch (e) {
      setErr(e?.message || String(e));
      setScore(null);
    }
  }
  async function startRecord() {
    try {
      setErr("");
      await ensureMic();
      chunksRef.current = [];
      mediaRecRef.current.start();
      setIsRecording(true);
    } catch (e) {
      setErr("Microphone error: " + (e?.message || String(e)));
      setIsRecording(false);
    }
  }
  function stopRecord() {
    try { if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop(); } catch {}
  }

  // --- one-click: play & record together ---
  async function playAndShadow() {
    if (!audioRef.current) return;
    setScore(null);
    try {
      await ensureMic();
      chunksRef.current = [];
      mediaRecRef.current.start();
      setIsRecording(true);
      setIsPlaying(true);
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setIsPlaying(false));
      // stop recording lidt efter native ender
      const nativeMs = (nativeBuf.current?.duration || audioRef.current.duration || 2) * 1000;
      setTimeout(() => stopRecord(), Math.max(1200, nativeMs + 300));
    } catch (e) {
      setErr("Microphone error: " + (e?.message || String(e)));
      setIsRecording(false);
    }
  }

  // --- envelope + timing analysis (client-side) ---
  function computeEnvelope(audioBuffer, frameMs = 50) {
    const sr = audioBuffer.sampleRate;
    const ch = audioBuffer.numberOfChannels;
    // sum mono
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
    // normalize
    const max = Math.max(...env, 1e-6);
    return env.map(x => x / max);
  }

  function crossCorrelation(a, b, maxLagFrames = 30) {
    // returns { bestLag, bestCorr, corrAt0 }
    let bestCorr = -1, bestLag = 0;
    const corrAt0 = corrAtLag(0); // (ikke brugt videre, men fint at have)
    function corrAtLag(lag) {
      let sxy = 0, sx2 = 0, sy2 = 0, n = 0;
      for (let i = 0; i < a.length; i++) {
        const j = i + lag;
        if (j < 0 || j >= b.length) continue;
        const x = a[i], y = b[j];
        sxy += x * y; sx2 += x * x; sy2 += y * y; n++;
      }
      if (!n) return 0;
      const denom = Math.sqrt(sx2 * sy2) || 1e-6;
      return sxy / denom;
    }
    for (let lag = -maxLagFrames; lag <= maxLagFrames; lag++) {
      const c = corrAtLag(lag);
      if (c > bestCorr) { bestCorr = c; bestLag = lag; }
    }
    return { bestLag, bestCorr, corrAt0 };
  }

  async function analyzeShadow(userBlob) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const arr = await userBlob.arrayBuffer();
      const ubuf = await ac.decodeAudioData(arr);
      userEnvelope.current = computeEnvelope(ubuf);

      const a = nativeEnvelope.current;
      const b = userEnvelope.current;
      const { bestLag, bestCorr } = crossCorrelation(a, b, 30); // ±30*50ms = ±1.5s

      // duration match (1 - relative error)
      const nd = nativeBuf.current?.duration || 1;
      const ud = ubuf.duration || 1;
      const durMatch = Math.max(0, 1 - Math.abs(ud - nd) / Math.max(nd, ud));

      // combine
      const timing01 = Math.max(0, Math.min(1, 0.75 * bestCorr + 0.25 * durMatch));
      const timingPct = Math.round(timing01 * 100);

      setScore({
        timing: timingPct,
        latencyMs: bestLag * 50,
        durationMatch: Math.round(durMatch * 100),
        nativeDur: Math.round(nd * 100) / 100,
        userDur: Math.round(ud * 100) / 100,
      });
      setErr("");
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
      setScore(null);
    }
  }

  // draw simple sparklines
  useEffect(() => {
    draw("native-canvas", nativeEnvelope.current, "#93C5FD");
    draw("user-canvas",   userEnvelope.current,   "#FDE68A");
  }, [score, text]); // redraw when we have a score or new sentence

  function draw(id, env, color) {
    const c = document.getElementById(id);
    if (!c) return;
    const ctx = c.getContext("2d");
    const w = (c.width = c.clientWidth * devicePixelRatio);
    const h = (c.height = c.clientHeight * devicePixelRatio);
    ctx.clearRect(0,0,w,h);
    if (!env || !env.length) return;
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let i = 0; i < env.length; i++) {
      const x = (i / (env.length - 1)) * w;
      const y = h - env[i] * (h - 4) - 2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // mount: do nothing until START
  return (
    <div className="w-full min-h-[calc(100vh-5rem)] bg-white px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-md">
        {!started && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#12131A] text-white rounded-[28px] shadow-xl p-5 grid gap-4 place-items-center"
          >
            <div className="text-center">
              <div className="text-xl font-semibold">Speak Along</div>
              <div className="text-white/60 text-sm mt-1">Listen & speak along with the native voice</div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-white/80">
              <label>Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 outline-none"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              <span className="mx-1">•</span>

              <label>Accent</label>
              <select
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 outline-none"
              >
                <option value="en_us">American</option>
                <option value="en_br">British</option>
              </select>
            </div>

            <button
              onClick={() => { 
                setStarted(true); 
                setTimeout(() => loadSentence(level, accent, false), 0); // no autoplay
              }}
              className="w-40 h-12 rounded-full font-semibold text-white shadow-lg"
              style={{ backgroundImage: `linear-gradient(90deg, ${ACCENT}, ${PRIMARY})` }}
            >
              START
            </button>
          </motion.div>
        )}

        {started && (
          <motion.div
            layout
            className="bg-[#12131A] text-white rounded-[28px] shadow-xl p-4 sm:p-5"
            transition={{ type: "spring", stiffness: 160, damping: 26, mass: 0.9 }}
          >
            {/* header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full" style={{ background: "#34D399" }} />
                <div className="flex flex-col">
                  <p className="text-base font-medium">Speak Along</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-white/70 mt-1">
                    <label>Level</label>
                    <select
                      value={level}
                      onChange={(e) => { setLevel(e.target.value); loadSentence(e.target.value, accent, false); }} // ← no autoplay
                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 outline-none"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>

                    <span className="mx-2">•</span>

                    <label>Accent</label>
                    <select
                      value={accent}
                      onChange={(e) => { setAccent(e.target.value); loadSentence(level, e.target.value, false); }} // ← no autoplay
                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 outline-none"
                    >
                      <option value="en_us">American</option>
                      <option value="en_br">British</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={() => loadSentence(level, accent, false)} // ← no autoplay
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20"
                title="New line"
              >
                <RefreshCw className="h-4 w-4" /> New
              </button>
            </div>

            {/* sentence */}
            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 mb-3">
              <div className="text-sm text-white/60 uppercase">Target</div>
              <div className="text-lg font-semibold break-words">{text || "…"}</div>
              <div className="mt-1 text-white/60 text-sm">Voice: {voiceLabel === "en-GB" ? "British" : "American"}</div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={playNative}
                  className={[
                    "flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2 font-semibold transition",
                    isPlaying ? "bg-white/20" : "bg-white/10 hover:bg-white/20",
                  ].join(" ")}
                  disabled={!text}
                >
                  <Play className="h-4 w-4" /> {isPlaying ? "Playing..." : "Play native"}
                </button>

                <button
                  onClick={playAndShadow}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2 font-semibold text-white shadow-lg"
                  style={{ backgroundImage: `linear-gradient(90deg, ${ACCENT}, ${PRIMARY})` }}
                  disabled={!text || isRecording}
                >
                  <Mic className="h-4 w-4" /> Shadow now
                </button>

                {isRecording && (
                  <button
                    onClick={stopRecord}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 font-semibold bg-white/10"
                  >
                    <StopCircle className="h-4 w-4" /> Stop
                  </button>
                )}
              </div>

              <div className="text-white/60 text-sm mt-2 flex items-center gap-1">
                <ChevronRight className="h-4 w-4" /> Listen & speak along — we’ll score your timing
              </div>
            </div>

            {/* results */}
            {score && (
              <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                <div className="text-sm text-white/60 uppercase mb-1">Timing Result</div>
                <div className="text-4xl font-extrabold" style={{ color: "#93C5FD" }}>
                  {score.timing}%
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-white/80">
                  <div>Latency: <span className="font-semibold">{score.latencyMs} ms</span></div>
                  <div>Duration match: <span className="font-semibold">{score.durationMatch}%</span></div>
                  <div>Native: <span className="font-semibold">{score.nativeDur}s</span></div>
                  <div>You: <span className="font-semibold">{score.userDur}s</span></div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-white/60 mb-1">Native envelope</div>
                    <div className="h-16 rounded-xl bg-black/20 overflow-hidden">
                      <canvas id="native-canvas" className="w-full h-full block" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white/60 mb-1">Your envelope</div>
                    <div className="h-16 rounded-xl bg-black/20 overflow-hidden">
                      <canvas id="user-canvas" className="w-full h-full block" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* error */}
            {err && <div className="mt-3 text-[13px] text-red-500">{err}</div>}
          </motion.div>
        )}
      </div>
    </div>
  );
}
