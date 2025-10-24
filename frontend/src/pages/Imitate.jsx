// src/pages/Imitate.jsx
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Mic, StopCircle, ChevronRight, RefreshCw } from "lucide-react";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";

const PRIMARY = "#2196F3";
const ACCENT  = "#FF9800";

export default function Imitate() {
  // collapsed -> viser kun titel + START
  const [started, setStarted] = useState(false);

  // UI state
  const [level, setLevel]   = useState("easy");      // easy | medium | hard
  const [accent, setAccent] = useState("en_us");     // en_us | en_br
  const [sample, setSample] = useState({ text: "", voice: "en-US" });
  const [result, setResult] = useState(null);
  const [err, setErr]       = useState("");

  // audio/recorder state
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying]     = useState(false);
  const audioRef     = useRef(null);
  const mediaRecRef  = useRef(null);
  const chunksRef    = useRef([]);

  // Autoplay-gating
  const hasInteractedRef   = useRef(false); // er der klikket/tastet?
  const pendingAutoPlayRef = useRef(null);  // {text, accent} der venter på at blive afspillet

  // Guard mod overlappende loads
  const requestSeqRef = useRef(0);

  /* ---------------- global første interaktion ---------------- */
  useEffect(() => {
    const markInteracted = () => {
      if (!hasInteractedRef.current) {
        hasInteractedRef.current = true;
        const p = pendingAutoPlayRef.current;
        if (p?.text) {
          pendingAutoPlayRef.current = null;
          speakNative(p.text, p.accent);
        }
      }
    };
    window.addEventListener("pointerdown", markInteracted, { once: true, capture: true });
    window.addEventListener("keydown",      markInteracted, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", markInteracted, { capture: true });
      window.removeEventListener("keydown",      markInteracted, { capture: true });
    };
  }, []);

  /* ---------------- TTS: play/stop ---------------- */
  async function speakNative(text, accentCode) {
    try {
      if (!text) return;
      if (!hasInteractedRef.current) {
        pendingAutoPlayRef.current = { text, accent: accentCode };
        return;
      }
      setIsPlaying(true);

      const qs = new URLSearchParams({ text, accent: accentCode }).toString();
      const r  = await fetch(`/api/tts?${qs}`);
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`TTS failed (HTTP ${r.status}): ${t || "<empty>"}`);
      }

      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);

      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
        if (audioRef.current.src?.startsWith("blob:")) {
          try { URL.revokeObjectURL(audioRef.current.src); } catch {}
        }
      }
      const a = new Audio(url);
      audioRef.current = a;
      a.onended  = () => { setIsPlaying(false); try { URL.revokeObjectURL(url); } catch {} };
      a.onerror  = () => { setIsPlaying(false); try { URL.revokeObjectURL(url); } catch {} };
      a.play().catch(() => {
        setIsPlaying(false);
        pendingAutoPlayRef.current = { text, accent: accentCode };
      });
    } catch (e) {
      console.error(e);
      setIsPlaying(false);
      if (!/NotAllowedError/i.test(String(e?.name) + " " + String(e?.message))) {
        setErr(e?.message || String(e));
      }
    }
  }
  function stopNative() {
    try { audioRef.current?.pause(); } catch {}
    setIsPlaying(false);
  }
  useEffect(() => {
    return () => {
      try { audioRef.current?.pause(); } catch {}
      if (audioRef.current?.src?.startsWith("blob:")) {
        try { URL.revokeObjectURL(audioRef.current.src); } catch {}
      }
    };
  }, []);

  /* ---------------- Generate sentence ---------------- */
  async function loadSentence(levelArg = level, accentArg = accent) {
    try {
      setErr("");
      setResult(null);
      setSample((s) => ({ ...s, text: "…" }));

      const seq = ++requestSeqRef.current; // markér denne request som den nyeste

      const r = await fetch("/api/generate-sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: levelArg, accent: accentArg }),
      });

      const raw = await r.text();
      let json;
      try { json = JSON.parse(raw); }
      catch { throw new Error(`Bad JSON (status ${r.status}): ${raw?.slice(0,200) || "<empty>"}`); }
      if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);

      // Hvis en nyere request er startet, ignorér denne respons.
      if (seq !== requestSeqRef.current) return;

      setSample({ text: json.text, voice: json.voice });

      // Autoplay
      speakNative(json.text, accentArg);
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
      setSample({ text: "", voice: accentArg === "en_br" ? "en-GB" : "en-US" });
    }
  }

  // Når man skifter level/accent EFTER start, henter vi ny sætning og spiller
  useEffect(() => {
    if (started) loadSentence(level, accent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, accent, started]);

  /* ---------------- Recorder helpers ---------------- */
  function disposeRecorder() {
    try {
      if (mediaRecRef.current?.stream) {
        mediaRecRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    mediaRecRef.current = null;
  }
  async function ensureMic() {
    disposeRecorder();
    const mime =
      (MediaRecorder.isTypeSupported &&
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))
        ? "audio/webm;codecs=opus"
        : "audio/webm";
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
    sendToServer(blob);
  }
  async function startRecord() {
    try {
      hasInteractedRef.current = true;
      setErr("");
      setResult(null);
      await ensureMic();
      if (!mediaRecRef.current) throw new Error("Mic recorder not ready.");
      chunksRef.current = [];
      mediaRecRef.current.start();
      setIsRecording(true);
    } catch (e) {
      setErr("Microphone error: " + (e?.message || String(e)));
      setIsRecording(false);
    }
  }
  function stopRecord() {
    try {
      const rec = mediaRecRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
    } catch {}
  }

  /* ---------------- Send to analyzer ---------------- */
  async function sendToServer(audioBlob) {
    try {
      const fd = new FormData();
      fd.append("audio",  audioBlob, "clip.webm");
      fd.append("refText", sample.text);
      fd.append("accent", accent);

      const r = await fetch("/api/analyze-speech", { method: "POST", body: fd });
      const raw = await r.text();
      let json;
      try { json = JSON.parse(raw); }
      catch { throw new Error(`Bad JSON (status ${r.status}): ${raw?.slice(0,200) || "<empty>"}`); }
      if (!r.ok) throw new Error(json?.error || r.statusText);

      setResult(json);
      setErr("");
    } catch (e) {
      setErr(e?.message || String(e));
      setResult(null);
    }
  }

  /* ---------------- Render ---------------- */
  return (
    <div className="w-full min-h-[calc(100vh-5rem)] bg-white px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-md">
        {/* Collapsed START view */}
        {!started && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#12131A] text-white rounded-[28px] shadow-xl p-5 grid gap-4 place-items-center"
          >
            <div className="text-center">
              <div className="text-xl font-semibold">Imitate the Native</div>
            </div>
            <button
              onClick={() => {
                hasInteractedRef.current = true; // dette klik tillader autoplay
                setStarted(true);                 // første sætning hentes af useEffect
              }}
              className="w-40 h-12 rounded-full font-semibold text-white shadow-lg"
              style={{ backgroundImage: `linear-gradient(90deg, ${ACCENT}, ${PRIMARY})` }}
            >
              START
            </button>
          </motion.div>
        )}

        {/* Expanded full card */}
        {started && (
          <motion.div
            layout
            className="bg-[#12131A] text-white rounded-[28px] shadow-xl p-4 sm:p-5"
            transition={{ type: "spring", stiffness: 160, damping: 26, mass: 0.9 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full" style={{ background: "#FFB020" }} />
                <div className="flex flex-col">
                  <p className="text-base font-medium">Imitate the Native</p>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-white/70 mt-1">
                    <label>Difficulty</label>
                    <select
                      value={level}
                      onChange={(e) => { hasInteractedRef.current = true; setLevel(e.target.value); }}
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
                      onChange={(e) => { hasInteractedRef.current = true; setAccent(e.target.value); }}
                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 outline-none"
                    >
                      <option value="en_us">American</option>
                      <option value="en_br">British</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={() => { hasInteractedRef.current = true; loadSentence(level, accent); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20"
                title="New sentence"
              >
                <RefreshCw className="h-4 w-4" /> New
              </button>
            </div>

            {/* Sentence */}
            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 mb-3">
              <div className="text-sm text-white/60 uppercase">Target</div>
              <div className="text-lg font-semibold break-words">{sample.text || "…"}</div>
              <div className="mt-1 text-white/60 text-sm">
                Voice: {sample.voice === "en-GB" ? "British" : "American"}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  hasInteractedRef.current = true;
                  isPlaying ? stopNative() : speakNative(sample.text, accent);
                }}
                className={[
                  "flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3 font-semibold transition",
                  isPlaying ? "bg-white/20" : "bg-white/10 hover:bg-white/20",
                ].join(" ")}
                disabled={!sample.text}
              >
                <Play className="h-5 w-5" />
                {isPlaying ? "Playing..." : "Play Native"}
              </button>

              <button
                onClick={isRecording ? stopRecord : startRecord}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white shadow-lg"
                style={{ backgroundImage: `linear-gradient(90deg, ${ACCENT}, ${PRIMARY})` }}
                disabled={!sample.text}
              >
                {isRecording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                {isRecording ? "Stop" : "Record"}
              </button>
            </div>

            {/* Hint */}
            <div className="text-white/60 text-sm mt-2 flex items-center gap-1">
              <ChevronRight className="h-4 w-4" /> Listen → Record → Get feedback
            </div>
          </motion.div>
        )}

        {/* Error */}
        {err && <div className="max-w-md mx-auto mt-3 text-[13px] text-red-500">{err}</div>}

        {/* Feedback */}
        {result && (
          <motion.div
            className="max-w-md mx-auto"
            animate={{ marginTop: 8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <PhonemeFeedback result={result} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
