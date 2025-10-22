// frontend/src/pages/Record.jsx
import React, { useEffect, useRef, useState } from "react";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, StopCircle, ChevronUp, X, Bookmark, Trash2, Plus } from "lucide-react";
import { getBookmarks, setBookmarks } from "../lib/bookmarks.js";

const PRIMARY = "#2196F3";
const ACCENT = "#FF9800";

/* ---------------- Bookmarks panel ---------------- */
function BookmarksPanel({ onUse }) {
  const [items, setItems] = useState(getBookmarks());
  useEffect(() => {
    const onStorage = (e) => e.key === "ac_bookmarks_v1" && setItems(getBookmarks());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  function remove(id) {
    const next = items.filter((b) => b.id !== id);
    setItems(next);
    setBookmarks(next);
  }
  return (
    <div className="bg-[#0E1B2A] text-white rounded-[28px] shadow-xl p-4 sm:p-5 mt-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-10 w-10 rounded-full grid place-items-center bg-white/10">
          <Bookmark className="h-5 w-5" />
        </div>
        <p className="text-base font-medium">Bookmarks</p>
      </div>
      {items.length === 0 ? (
        <div className="text-white/60 text-sm">No bookmarks yet. Add some from the feedback card.</div>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-3">
          {items.map((b) => (
            <li key={b.id} className="rounded-2xl bg-white/5 border border-white/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm uppercase tracking-wide text-white/60">{b.type}</div>
                  <div className="font-semibold text-white break-words">{b.text}</div>
                  {b.ipa && <div className="text-white/70 mt-0.5">{b.ipa}</div>}
                  {typeof b.score === "number" && (
                    <div className="text-white/70 text-sm mt-0.5">
                      Score: <span className="font-semibold">{b.score}%</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => onUse(b.text)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20"
                    title="Use this text"
                  >
                    <Plus className="h-4 w-4" /> Use
                  </button>
                  <button
                    onClick={() => remove(b.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20"
                    title="Delete bookmark"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Record page ---------------- */
export default function Record() {
  const [accentUi, setAccentUi] = useState("en_us");
  const [refText, setRefText] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const [expanded, setExpanded] = useState(true);
  const [inputActive, setInputActive] = useState(false); // <— kun én gang!

  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const textAreaRef = useRef(null);
  const cardRef = useRef(null); // “click outside”

  // Focus textarea when expanded
  useEffect(() => {
    if (expanded && textAreaRef.current) textAreaRef.current.focus();
  }, [expanded]);

  // Click-outside: skjul input-controls kun ved klik UDENFOR kortet
  useEffect(() => {
    function onDown(e) {
      if (!cardRef.current) return;
      const inside = cardRef.current.contains(e.target);
      if (!inside) setInputActive(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

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

      // Efter analyse: ryd feltet og kollaps kortet for at give plads til feedback
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
  const taHeight = analyzed ? 100 : (expanded ? 150 : 90);

  // Bookmarks-panel KUN på forsiden
  const isFrontPage = !analyzed && !isRecording && !hasText && !inputActive;

  return (
    <div className="w-full min-h-[calc(100vh-5rem)] bg-white px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-md">
        <motion.div
          ref={cardRef}
          layout
          className="bg-[#12131A] text-white rounded-[28px] shadow-xl pt-4 px-4 sm:px-5 relative"
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

          {/* Textarea */}
          <motion.textarea
            ref={textAreaRef}
            value={refText}
            onChange={(e) => setRefText(e.target.value)}
            onFocus={() => { setExpanded(true); setInputActive(true); }}
            placeholder="Tap to type..."
            animate={{ height: taHeight }}
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

          {/* Start/Stop (hidden in feedback unless typing or recording) */}
          <div className="mt-4">
            {(!analyzed || inputActive || isRecording) && (
              <button
                onClick={toggleRecording}
                disabled={!hasText}
                className={[
                  "w-full text-white font-semibold rounded-full py-3.5 flex items-center justify-center gap-2 transition focus:outline-none",
                  hasText ? "shadow-lg" : "opacity-60 cursor-not-allowed bg-white/10",
                ].join(" ")}
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
            )}
          </div>
        </motion.div>

        {/* error */}
        {err && <div className="max-w-md mx-auto mt-3 text-[13px] text-red-500">{err}</div>}

        {/* Bookmarks — kun på forsiden */}
        {isFrontPage && (
          <div className="w-full max-w-md">
            <BookmarksPanel
              onUse={(text) => {
                setRefText(text || "");
                setExpanded(true);
                setResult(null);      // Skjul feedback → start-knap kommer igen
                setInputActive(true); // Vis kontroller
                setTimeout(() => textAreaRef.current?.focus(), 0);
              }}
            />
          </div>
        )}

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
