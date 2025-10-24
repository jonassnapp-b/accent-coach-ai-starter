// src/pages/Conversation.jsx
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Mic, StopCircle, RefreshCw } from "lucide-react";

const PRIMARY = "#2196F3";
const ACCENT  = "#FF9800";

export default function Conversation() {
  // Collapsed start
  const [started, setStarted] = useState(false);

  // settings
  const [level, setLevel]   = useState("easy");     // easy | medium | hard
  const [accent, setAccent] = useState("en_us");    // en_us | en_br
  const [topic, setTopic]   = useState("daily life");

  // convo state
  const [partnerText, setPartnerText] = useState("");
  const [history, setHistory] = useState([]);       // [{role:"partner"|"user", text:"..."}]
  const [err, setErr] = useState("");

  // recorder
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecRef  = useRef(null);
  const chunksRef    = useRef([]);

  // audio
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // autoplay gating
  const hasInteractedRef   = useRef(false);
  const pendingAutoPlayRef = useRef(null); // { text }

  /* ---------------- TTS ---------------- */
  async function speak(text) {
    try {
      if (!text) return;

      // gate autoplay til efter første interaktion
      if (!hasInteractedRef.current) {
        pendingAutoPlayRef.current = { text };
        return;
      }

      setIsPlaying(true);
      try { audioRef.current?.pause(); } catch {}

      const qs = new URLSearchParams({ text, accent }).toString();
      const r = await fetch(`/api/tts?${qs}`);
      if (!r.ok) throw new Error(`TTS failed: HTTP ${r.status}`);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);

      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => { setIsPlaying(false); URL.revokeObjectURL(url); };
      a.onerror = () => { setIsPlaying(false); URL.revokeObjectURL(url); };
      await a.play();
    } catch (e) {
      setIsPlaying(false);
      setErr(e?.message || String(e));
    }
  }

  useEffect(() => {
    return () => { try { audioRef.current?.pause(); } catch {} };
  }, []);

  /* ---------------- Backend ---------------- */
  async function startConversation() {
    try {
      setErr("");
      setHistory([]);
      setPartnerText("…");

      const r = await fetch("/api/conv/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, accent, topic }),
      });

      const raw = await r.text();
      let json;
      try { json = JSON.parse(raw); }
      catch { throw new Error(`Bad JSON (status ${r.status}): ${raw?.slice(0,200) || "<empty>"}`); }
      if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);

      const first = json.partnerText || "";
      setPartnerText(first);
      setHistory([{ role: "partner", text: first }]);

      // autoplay (vil blive queued hvis ingen interaktion endnu)
      speak(first);
    } catch (e) {
      setErr(e?.message || String(e));
      setPartnerText("");
    }
  }

  async function sendReplyAudio(blob) {
    try {
      const userText = "(user reply audio)"; // TODO: wire ASR
      const newHistory = [...history, { role: "user", text: userText }];

      const r = await fetch("/api/conv/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, accent, topic, history: newHistory, text: userText }),
      });

      const raw = await r.text();
      let json;
      try { json = JSON.parse(raw); }
      catch { throw new Error(`Bad JSON (status ${r.status}): ${raw?.slice(0,200) || "<empty>"}`); }
      if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);

      const nextTurn = json.partnerText || "";
      setPartnerText(nextTurn);
      setHistory([...newHistory, { role: "partner", text: nextTurn }]);
      speak(nextTurn);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  /* ---------------- Recorder helpers ---------------- */
  function disposeRecorder() {
    try { mediaRecRef.current?.stream?.getTracks().forEach(t => t.stop()); } catch {}
    mediaRecRef.current = null;
  }
  async function ensureMic() {
    disposeRecorder();
    const mime =
      (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))
        ? "audio/webm;codecs=opus"
        : "audio/webm";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: mime });
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
    sendReplyAudio(blob);
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

  /* ---------------- Start-flow & ændringer ---------------- */
  // Når man klikker START
  function handleStart() {
    hasInteractedRef.current = true;   // tillad autoplay
    setStarted(true);
    // hvis der lå noget og ventede, spil det efter klik
    const p = pendingAutoPlayRef.current;
    pendingAutoPlayRef.current = null;
    startConversation().then(() => {
      if (p?.text) speak(p.text);
    });
  }

  // Når settings ændres EFTER start -> hent ny første sætning
  useEffect(() => {
    if (started) startConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, accent, topic, started]);

  /* ---------------- UI ---------------- */
  return (
    <div className="w-full min-h-[calc(100vh-5rem)] bg-white px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-md">

        {/* Collapsed START view */}
        {!started && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#12131A] text-white rounded-[28px] shadow-xl p-6 grid gap-4 place-items-center"
          >
            <div className="text-center">
              <div className="text-xl font-semibold">Conversation Trainer</div>
              <div className="text-white/70 mt-1 text-sm">
                Click START to begin the dialogue.
              </div>
            </div>
            <button
              onClick={handleStart}
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
            {/* header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full" style={{ background: "#2DD4BF" }} />
                <div className="flex flex-col">
                  <p className="text-base font-medium">Conversation Trainer</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-white/70 mt-1">
                    <label>Level</label>
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

                    <span className="mx-2">•</span>

                    <label>Topic</label>
                    <select
                      value={topic}
                      onChange={(e) => { hasInteractedRef.current = true; setTopic(e.target.value); }}
                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 outline-none"
                    >
                      <option>daily life</option>
                      <option>travel</option>
                      <option>work</option>
                      <option>school</option>
                      <option>hobbies</option>
                      <option>food</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={() => { hasInteractedRef.current = true; startConversation(); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg白/20"
                title="New"
              >
                <RefreshCw className="h-4 w-4" /> New
              </button>
            </div>

            {/* partner bubble */}
            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 mb-3">
              <div className="text-sm text-white/60 uppercase">Partner</div>
              <div className="text-lg font-semibold min-h-[2.5rem] break-words">
                {partnerText || "…"}
              </div>

              <div className="mt-2">
                <button
                  onClick={() => { hasInteractedRef.current = true; speak(partnerText); }}
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-xl py-2 px-3 font-semibold transition",
                    isPlaying ? "bg-white/20" : "bg-white/10 hover:bg-white/20",
                  ].join(" ")}
                  disabled={!partnerText}
                >
                  <Play className="h-4 w-4" /> {isPlaying ? "Playing..." : "Play"}
                </button>
              </div>
            </div>

            {/* record reply */}
            <button
              onClick={isRecording ? stopRecord : startRecord}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white shadow-lg"
              style={{ backgroundImage: `linear-gradient(90deg, ${ACCENT}, ${PRIMARY})` }}
              disabled={!partnerText}
            >
              {isRecording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              {isRecording ? "Stop" : "Record reply"}
            </button>

            <div className="text-white/60 text-sm mt-2">
              › Listen → Record → Get the next turn
            </div>
          </motion.div>
        )}

        {err && <div className="max-w-md mx-auto mt-3 text-[13px] text-red-500">{err}</div>}
      </div>
    </div>
  );
}
