// frontend/src/pages/Record.jsx
import React, { useEffect, useRef, useState } from "react";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, StopCircle, ChevronUp, X } from "lucide-react";

const PRIMARY = "#2196F3";
const ACCENT = "#FF9800";

export default function Record() {
  const [accentUi, setAccentUi] = useState("en_us");
  const [refText, setRefText] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  // Start udvidet første gang
  const [expanded, setExpanded] = useState(true);
// under your other useState lines
const [inputActive, setInputActive] = useState(false); // show controls only when user focuses


  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const textAreaRef = useRef(null);

  useEffect(() => {
    if (expanded && textAreaRef.current) textAreaRef.current.focus();
  }, [expanded]);

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
    const rec = new MediaRecorder(stream, { mimeType: mime });

    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e?.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
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
      setErr("");
      setResult(null);
      await ensureMic();
      const rec = mediaRecRef.current;
      if (!rec) throw new Error("Mic recorder not ready.");
      chunksRef.current = [];
      rec.start();
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

  async function toggleRecording() {
    if (!refText.trim()) {
      setErr("Please type a target word or phrase.");
      return;
    }
    if (isRecording) stopRecord();
    else await startRecord();
  }

  async function sendToServer(audioBlob) {
    try {
      if (!refText.trim()) {
        setErr("Please type a target word or phrase.");
        return;
      }
      const fd = new FormData();
      fd.append("audio", audioBlob, "clip.webm");
      fd.append("refText", refText.trim());
      fd.append("accent", accentUi === "en_br" ? "en_br" : "en_us");

      const r = await fetch("/api/analyze-speech", { method: "POST", body: fd });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error || r.statusText);

      setResult(json);
      setInputActive(false);
      setErr("");

      // Efter analyse: ryd feltet og kollaps kortet, så feedback får plads.
      setRefText("");
      setExpanded(false);
    } catch (e) {
      setErr(e?.message || String(e));
      setResult(null);
    }
  }

  function collapseAndReset() {
    setExpanded(false);
    setRefText("");
    setErr("");
    setResult(null);
  }

  const hasText = refText.trim().length > 0;
  const analyzed = !!result && !err;

  return (
    <div className="w-full min-h-[calc(100vh-5rem)] bg-white px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-md">
        <motion.div
  layout
  className="bg-[#12131A] text-white rounded-[28px] shadow-xl pt-4 px-4 sm:px-5 relative"
  // tighter bottom padding in feedback; normal elsewhere
  style={{ paddingBottom: analyzed ? (expanded ? 16 : 12) : 24 }}
  transition={{ type: "spring", stiffness: 160, damping: 26, mass: 0.9 }}
>

          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full" style={{ background: "#7C4DFF" }} />
            <div className="flex-1">
              <p className="text-base font-medium">Practice My Text</p>
            </div>
            {expanded && (
              <button
                onClick={collapseAndReset}
                className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 grid place-items-center transition"
                aria-label="Collapse"
              >
                <ChevronUp className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Textarea – åbner kortet igen på fokus/skrivning */}
          <motion.textarea
  ref={textAreaRef}
  value={refText}
  onChange={(e) => setRefText(e.target.value)}
  onClick={() => { setExpanded(true); setInputActive(true); }}
  onFocus={() => setInputActive(true)}
  onBlur={() => { if (!refText.trim()) setInputActive(false); }}
  placeholder={expanded ? "Tap to type..." : "Tap to type..."}
  animate={{ height: analyzed ? 120 : expanded ? 180 : 80 }}
  transition={{ type: "spring", stiffness: 140, damping: 22, mass: 0.9 }}
  className="w-full resize-none rounded-2xl bg-white/5 border border-white/10 outline-none text-[15px] leading-6 p-3 placeholder:text-white/40 text-white"
  maxLength={1000}
/>


          {/* Counter + Clear */}
{(!analyzed || inputActive) && (
  <div className="flex items-center justify-between px-2 py-2">
    <div className="text-white/50 text-sm">{refText.length} / 1,000</div>
    <AnimatePresence>
      {hasText && (
        <motion.button
          key="clear"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={() => setRefText("")}
          className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center"
        >
          <X className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  </div>
)}

{/* Accent selector */}
{(!analyzed || inputActive) && (
  <div className="flex items-center gap-2 mt-1">
    <label className="text-sm text-white/70">Accent</label>
    <select
      value={accentUi}
      onChange={(e) => setAccentUi(e.target.value)}
      className="ml-1 text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none focus:ring-2"
      style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}
    >
      <option value="en_us">American English (US)</option>
      <option value="en_br">British English (UK)</option>
    </select>
  </div>
)}


          {/* Start/Stop */}
          <div className={analyzed ? "mt-3" : "mt-4"}>
            <button
              onClick={toggleRecording}
              disabled={!hasText}
              className={
                "w-full text-white font-semibold rounded-full py-3.5 flex items-center justify-center gap-2 transition focus:outline-none " +
                (hasText ? "" : "opacity-60 cursor-not-allowed bg-white/10")
              }
              style={hasText ? { backgroundImage: `linear-gradient(90deg, ${ACCENT}, ${PRIMARY})` } : {}}
            >
              {isRecording ? (
                <>
                  <StopCircle className="h-5 w-5" /> Stop Recording
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5" /> Start Practicing
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* error */}
        {err && <div className="max-w-md mx-auto mt-3 text-[13px] text-red-500">{err}</div>}

        {/* feedback */}
        {/* Feedback area — only adds spacing if visible */}
{result && (
  <motion.div
  className="max-w-md mx-auto"
  animate={{ marginTop: result ? 8 : 0 }}
  transition={{ duration: 0.22, ease: "easeOut" }}
>
  {result && <PhonemeFeedback result={result} />}
</motion.div>
)}

      </div>
    </div>
  );
}
