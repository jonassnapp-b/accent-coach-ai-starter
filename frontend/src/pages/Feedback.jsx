// src/pages/Feedback.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bookmark, BookmarkCheck, Mic, StopCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";
import { toggleBookmark, isBookmarked } from "../lib/bookmarks.js";
import { useSettings } from "../lib/settings-store.jsx";
import * as sfx from "../lib/sfx.js";

const LAST_RESULT_KEY = "ac_last_result_v1";
const PRACTICE_LAST_ROUTE_KEY = "ac_practice_last_route_v1";

/* ------------ API base (web + native) ------------ */
function isNative() {
  return !!(window?.Capacitor && window.Capacitor.isNativePlatform);
}
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

function to01(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  return n <= 1 ? Math.max(0, Math.min(1, n)) : Math.max(0, Math.min(1, n / 100));
}

/** Compute same target text logic as PhonemeFeedback (so header bookmark matches) */
function computeTargetText(result) {
  const words = Array.isArray(result?.words) ? result.words : [];
  const targetSentenceRaw = String(result?.target || result?.reference || result?.text || result?.refText || "").trim();
  const recognition = String(result?.recognition ?? result?.transcript ?? "").trim();
  const wordsJoined = words.map((w) => (w.word ?? w.w ?? "")).join(" ").trim();
  const displaySentence = targetSentenceRaw || recognition || wordsJoined;

  const isSentence = words.length >= 2 || (typeof displaySentence === "string" && /\s/.test(displaySentence));

  const oneWord = !isSentence && words.length === 1 ? words[0] : null;
  const apiWordText = String(oneWord?.word ?? oneWord?.w ?? "").trim();

  const targetIsSingleWord = targetSentenceRaw && !/\s/.test(targetSentenceRaw);
  const wordText = targetIsSingleWord ? targetSentenceRaw : apiWordText;

  return oneWord ? (wordText || "") : (displaySentence || "");
}

export default function Feedback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useSettings();

  // keep WebAudio volume synced with settings
  useEffect(() => {
    if (settings.soundEnabled) sfx.setVolume(settings.soundVolume ?? 0.6);
  }, [settings.soundEnabled, settings.soundVolume]);

  const initialResult = useMemo(() => {
    const fromState = location.state?.result ? location.state.result : null;
    if (fromState) return fromState;

    try {
      const raw = sessionStorage.getItem(LAST_RESULT_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }, [location.state]);

  const [result, setResult] = useState(initialResult);

  useEffect(() => {
    if (!result) navigate("/record", { replace: true });
  }, [result, navigate]);

  // ✅ Persist latest result AND mark Feedback as last Practice page
  useEffect(() => {
    if (!result) return;
    try {
      sessionStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result));
      sessionStorage.setItem(PRACTICE_LAST_ROUTE_KEY, "/feedback");
    } catch {}
  }, [result]);

  if (!result) return null;

  const overall01 = to01(result?.overall ?? result?.pronunciation ?? result?.overallAccuracy);
  const targetText = computeTargetText(result);
  const targetScorePct = overall01 != null ? Math.round(overall01 * 100) : null;

  const [booked, setBooked] = useState(isBookmarked(targetText));
  useEffect(() => setBooked(isBookmarked(targetText)), [targetText]);

  function onToggleBookmark() {
    if (!targetText) return;
    toggleBookmark({
      text: targetText,
      ipa: "",
      score: targetScorePct,
      type: /\s/.test(targetText) ? "sentence" : "word",
      createdAt: Date.now(),
    });
    setBooked(isBookmarked(targetText));
  }

  /* ===================== Retry mode (same page) ===================== */
  const [retryText, setRetryText] = useState(""); // only set when user clicks Replay
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [err, setErr] = useState("");

  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const lastUrlRef = useRef(null);
  const retryBoxRef = useRef(null);

  function disposeRecorder() {
    try {
      mediaRecRef.current?.stream?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    mediaRecRef.current = null;
  }

  async function ensureMic() {
    disposeRecorder();

    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error("Microphone not supported on this device.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // choose supported mime (same logic as Record.jsx)
    let options = {};
    if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options.mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        options.mimeType = "audio/mp4";
      }
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
    rec.onstop = handleStop;
    mediaRecRef.current = rec;
  }

  async function startRetryRecord() {
    const text = String(retryText || "").trim();
    if (!text) return;

    try {
      setErr("");
      await ensureMic();
      chunksRef.current = [];
      mediaRecRef.current.start();
      setIsRecording(true);
      if (settings.soundEnabled) sfx.warm();
      if (settings.hapticsEnabled) sfx.hapticShort();
    } catch (e) {
      setErr("Microphone error: " + (e?.message || String(e)));
      setIsRecording(false);
      if (settings.soundEnabled) sfx.softFail();
    }
  }

  function stopRetryRecord() {
    try {
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
    } catch {}
  }

  function handleStop() {
    setIsRecording(false);

    const chunks = chunksRef.current.slice();
    chunksRef.current = [];

    const rec = mediaRecRef.current;
    disposeRecorder();

    // revoke previous url
    try {
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    } catch {}

    const type = chunks[0]?.type || rec?.mimeType || "audio/webm";
    const blob = new Blob(chunks, { type });
    const localUrl = URL.createObjectURL(blob);
    lastUrlRef.current = localUrl;

    setIsAnalyzing(true);
    sendRetryToServer(blob, localUrl);
  }

  async function sendRetryToServer(audioBlob, localUrl) {
    try {
      const text = String(retryText || "").trim();
      if (!text) throw new Error("Missing text.");

      const base = getApiBase();
      const fd = new FormData();
      fd.append("audio", audioBlob, "clip.webm");
      fd.append("refText", text);

      // keep same accent as current result if possible, else settings default
      const accent = (result?.accent || settings.accentDefault || "en_us") === "en_br" ? "en_br" : "en_us";
      fd.append("accent", accent);

      const r = await fetch(`${base}/api/analyze-speech`, { method: "POST", body: fd });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json?.error || r.statusText || "Analyze failed");

      const next = {
        ...json,
        userAudioUrl: localUrl,
        refText: text,
        accent,
        createdAt: Date.now(),
      };

      setResult(next);

      if (settings.soundEnabled) {
        const ov = Number(json?.overall ?? json?.overallAccuracy ?? json?.pronunciation ?? 0);
        if (ov >= 90) sfx.success({ strength: 2 });
        else if (ov >= 75) sfx.success({ strength: 1 });
      }
    } catch (e) {
      setErr(e?.message || String(e));
      if (settings.soundEnabled) sfx.softFail();
    } finally {
      setIsAnalyzing(false);
    }
  }

  // called from PhonemeFeedback replay button
  function handleRetry(text) {
    const t = String(text || "").trim();
    if (!t) return;
    setErr("");
    setRetryText(t);

    // scroll into view so user sees the mic immediately
    setTimeout(() => {
      try {
        retryBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {}
    }, 0);
  }

  const busy = isRecording || isAnalyzing;

  return (
    <div
      className="min-h-screen"
      style={{
        background: "#FFFFFF",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
      }}
    >
      <div className="mx-auto w-full max-w-[660px] px-4 sm:px-6">
        <div
          className="rounded-[22px] overflow-hidden"
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 12px 34px rgba(0,0,0,0.08)",
          }}
        >
          {/* Header INSIDE card - title is truly centered */}
          <div className="px-5 pt-5">
            <div
              className="grid items-center"
              style={{
                gridTemplateColumns: "120px 1fr 120px",
                columnGap: 10,
              }}
            >
              <div className="flex items-center justify-start">
                <Link
                  to="/record"
                  onClick={() => {
                    try {
                      sessionStorage.setItem(PRACTICE_LAST_ROUTE_KEY, "/record");
                    } catch {}
                  }}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[15px] font-semibold"
                  style={{
                    background: "rgba(0,0,0,0.04)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    color: "rgba(0,0,0,0.85)",
                  }}
                >
                  ← Back
                </Link>
              </div>

              <div className="text-center text-[16px] font-semibold" style={{ color: "rgba(0,0,0,0.70)" }}>
                Feedback
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={onToggleBookmark}
                  className="grid place-items-center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "rgba(0,0,0,0.04)",
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                  title={booked ? "Remove bookmark" : "Bookmark"}
                >
                  {booked ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div style={{ height: 10 }} />
          </div>

          <div className="px-4 sm:px-6 pb-5">
            <PhonemeFeedback result={result} embed hideBookmark onRetry={handleRetry} />

            {/* Retry area appears AFTER clicking Replay */}
            <AnimatePresence>
              {retryText ? (
                <motion.div
                  ref={retryBoxRef}
                  key="retry-box"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="mt-6 rounded-[18px] p-4"
                  style={{
                    background: "rgba(0,0,0,0.02)",
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <div className="text-center">
                    <div className="text-[12px] font-semibold" style={{ color: "rgba(0,0,0,0.45)" }}>
                      Try again
                    </div>
                    <div
                      className="mt-2 font-extrabold tracking-tight"
                      style={{
                        fontSize: 28,
                        color: "rgba(0,0,0,0.92)",
                        wordBreak: "break-word",
                      }}
                    >
                      {retryText}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col items-center">
                    <motion.button
                      onClick={() => (isRecording ? stopRetryRecord() : startRetryRecord())}
                      disabled={!retryText.trim() || isAnalyzing}
                      whileTap={{ scale: 0.98 }}
                      className={[
                        "relative grid place-items-center rounded-full",
                        !retryText.trim() || isAnalyzing ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                      style={{
                        width: 104,
                        height: 104,
                        background: "radial-gradient(circle at 30% 30%, #4fc3ff, #2196F3)",
                        boxShadow: "0 18px 40px rgba(33,150,243,0.28)",
                      }}
                      aria-label={isRecording ? "Stop recording" : "Start recording"}
                    >
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{ boxShadow: "inset 0 0 0 10px rgba(33,150,243,0.08)" }}
                      />
                      {isRecording ? <StopCircle className="h-10 w-10 text-white" /> : <Mic className="h-10 w-10 text-white" />}
                    </motion.button>

                    <div className="mt-4 text-[16px] font-semibold" style={{ color: "rgba(0,0,0,0.80)" }}>
                      {isRecording ? "Stop Recording" : isAnalyzing ? "Analyzing…" : "Start Recording"}
                    </div>

                    {err && <div className="mt-2 text-[13px] text-red-600">{err}</div>}

                    <div className="mt-2 text-[13px]" style={{ color: "rgba(0,0,0,0.50)" }}>
                      {busy ? " " : "Tap the mic to record again"}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
