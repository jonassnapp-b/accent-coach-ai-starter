// src/pages/ConversationCoach.jsx

import React, { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import { createRealtimeConversation } from "../lib/realtimeConversation.js";
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

export default function ConversationCoach() {
  const { settings } = useSettings?.() || { settings: {} };
  const accent = settings?.accentDefault || "en_us";

  const [assistantText, setAssistantText] = useState("");
  const [feedbackSummary, setFeedbackSummary] = useState("");
  const [feedbackTip, setFeedbackTip] = useState("");
  const [suggestedRepeat, setSuggestedRepeat] = useState("");
  const [weakPhonemes, setWeakPhonemes] = useState([]);
  const [weakWords, setWeakWords] = useState([]);
  const [hasEnteredConversation, setHasEnteredConversation] = useState(false);
  const [hasConversationStarted, setHasConversationStarted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [error, setError] = useState("");
  const [holdScale, setHoldScale] = useState(1);
  const [isWaitingToContinue, setIsWaitingToContinue] = useState(false);
  const [pendingNextAssistantText, setPendingNextAssistantText] = useState("");
const [spokenFeedbackText, setSpokenFeedbackText] = useState("");
const ttsAudioRef = useRef(null);
  const realtimeRef = useRef(null);
  const mountedRef = useRef(true);
  const holdStartedRef = useRef(false);
  const userSpeechStartedRef = useRef(false);
  const suppressNextAssistantResponseRef = useRef(false);
  const waitingForUserReleaseRef = useRef(false);
  const lastUserTranscriptRef = useRef("");
async function speakText(text) {
  const t = String(text || "").trim();
  if (!t) return;

  const base = getApiBase();

  const res = await fetch(`${base}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: t,
      accent: "en_us",
      rate: 1,
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || "TTS failed");
  }

  const buf = await res.arrayBuffer();
  const mime = (res.headers.get("content-type") || "audio/mpeg").split(";")[0].trim();
  const blob = new Blob([buf], { type: mime });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    try {
      if (!ttsAudioRef.current) {
        ttsAudioRef.current = new Audio();
      }

      const a = ttsAudioRef.current;
      a.src = url;
      a.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      a.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to play TTS"));
      };
      a.play().catch(reject);
    } catch (err) {
      URL.revokeObjectURL(url);
      reject(err);
    }
  });
}
  const isBusy = isStartingConversation;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      try {
        realtimeRef.current?.disconnect?.();
      } catch {}
    };
  }, []);
  function pronunciationLabel(score) {
    if (score >= 90) return "Excellent clarity";
    if (score >= 80) return "Good clarity";
    if (score >= 70) return "Understandable";
    return "Needs improvement";
  }

  function buildSpeechTip({ weakPhonemes: phonemes, weakWords: words, fluency, rhythm, speed }) {
    const topPhoneme = phonemes?.[0];
    const topWord = words?.[0];

    if (topPhoneme?.label === "θ") return 'Focus on the /th/ sound in "three"';
    if (topPhoneme?.label === "ð") return 'Keep the voiced /th/ soft and steady';
    if (topPhoneme?.label === "R") return "Keep your /r/ sound clearer and more consistent";
    if (topPhoneme?.label) return `Focus on the /${topPhoneme.label.toLowerCase()}/ sound`;

    if (topWord?.word) return `Say "${topWord.word}" more clearly`;

    if (typeof fluency === "number" && fluency < 75) return "Try to speak a little more smoothly";
    if (typeof rhythm === "number" && rhythm < 75) return "Keep a steadier rhythm across the sentence";
    if (typeof speed === "number" && speed > 115) return "Slow down slightly for clearer pronunciation";
    if (typeof speed === "number" && speed < 75) return "Speak a little more confidently and steadily";

    return "Nice job — keep your pronunciation steady";
  }
  function extractUserTranscriptFromMessage(msg) {
    const type = String(msg?.type || "");

    const directTranscript =
      typeof msg?.transcript === "string"
        ? msg.transcript
        : typeof msg?.text === "string"
        ? msg.text
        : typeof msg?.delta === "string"
        ? msg.delta
        : typeof msg?.item?.content?.[0]?.transcript === "string"
        ? msg.item.content[0].transcript
        : typeof msg?.item?.content?.[0]?.text === "string"
        ? msg.item.content[0].text
        : typeof msg?.part?.transcript === "string"
        ? msg.part.transcript
        : typeof msg?.part?.text === "string"
        ? msg.part.text
        : "";

    const itemRole = String(msg?.item?.role || "").toLowerCase();

    const isUserTranscriptEvent =
      type === "conversation.item.input_audio_transcription.completed" ||
      type === "input_audio_transcription.completed" ||
      type === "conversation.item.input_audio_transcription.delta" ||
      type === "input_audio_transcription.delta" ||
      (type === "conversation.item.created" && itemRole === "user") ||
      (type === "conversation.item.updated" && itemRole === "user");

    if (!isUserTranscriptEvent) return "";

    return String(directTranscript || "").replace(/\s+/g, " ").trim();
  }
  function applySpeechFeedback(ui) {
    const overallAccuracy = Number(ui?.overallAccuracy || 0);

    const weakPhonemes = (ui?.words || [])
      .flatMap((w) => w?.phonemes || [])
      .map((p) => ({
        label: String(p?.phoneme || p?.ph || "").trim().toUpperCase(),
        score: Number(p?.accuracyScore || 0),
      }))
      .filter((p) => p.label && Number.isFinite(p.score) && p.score < 85)
      .sort((a, b) => a.score - b.score)
      .filter((p, index, arr) => arr.findIndex((x) => x.label === p.label) === index)
      .slice(0, 2);

    const weakWords = (ui?.words || [])
      .map((w) => ({
        word: String(w?.word || w?.w || "").trim(),
        score: Number(w?.accuracyScore || 0),
      }))
      .filter((w) => w.word && Number.isFinite(w.score) && w.score < 85)
      .sort((a, b) => a.score - b.score)
      .slice(0, 2);

    setFeedbackSummary(
      `Pronunciation: ${overallAccuracy}% — ${pronunciationLabel(overallAccuracy)}`
    );
    setWeakPhonemes(weakPhonemes);
    setWeakWords(weakWords);
    setSuggestedRepeat("");
    setFeedbackTip(
      buildSpeechTip({
        weakPhonemes,
        weakWords,
        fluency: ui?.fluency,
        rhythm: ui?.rhythm,
        speed: ui?.speed,
      })
    );
  }

async function analyzeUserTurn(recording) {
  if (!recording?.base64) {
    setIsAnalyzing(false);
    setFeedbackSummary("I didn’t hear anything. Hold the button and try again.");
    setFeedbackTip("");
    setWeakPhonemes([]);
    setWeakWords([]);
    setIsWaitingToContinue(false);
    return;
  }

  try {
    const base = getApiBase();

  const azureController = new AbortController();
const azureTimeout = setTimeout(() => azureController.abort(), 15000);

let azureRes;

try {
console.log("[ConversationCoach] calling", `${base}/api/azure-pronunciation`);
  azureRes = await fetch(`${base}/api/azure-pronunciation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioBase64: recording.base64,
      mime: recording.mimeType || "audio/webm",
    }),
    signal: azureController.signal,
  });
} finally {
  clearTimeout(azureTimeout);
}

    const azureJson = await azureRes.json().catch(() => ({}));
console.log("[ConversationCoach] azure status =", azureRes.status, azureRes.url);
console.log("[ConversationCoach] azure json =", azureJson);
    if (!azureRes.ok) {
      throw new Error(azureJson?.error || "Azure pronunciation failed");
    }

    const userTranscript = String(azureJson?.transcript || "").trim();

    if (!userTranscript) {
      setFeedbackSummary("I couldn’t transcribe what you said. Please try again.");
      setFeedbackTip("");
      setWeakPhonemes([]);
      setWeakWords([]);
      setSpokenFeedbackText("");
      setPendingNextAssistantText("");
      setIsWaitingToContinue(false);
      setIsAnalyzing(false);
      return;
    }

  const aiController = new AbortController();
const aiTimeout = setTimeout(() => aiController.abort(), 15000);

let aiRes;

try {
  console.log("[ConversationCoach] calling", `${base}/api/ai-pronunciation-feedback`);
  aiRes = await fetch(`${base}/api/ai-pronunciation-feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assistantPrompt: assistantText || "",
      userTranscript,
      azureScores: azureJson,
    }),
    signal: aiController.signal,
  });
} finally {
  clearTimeout(aiTimeout);
}

    const aiJson = await aiRes.json().catch(() => ({}));
console.log("[ConversationCoach] ai status =", aiRes.status, aiRes.url);
console.log("[ConversationCoach] ai json =", aiJson);
    if (!aiRes.ok) {
      throw new Error(aiJson?.error || "AI feedback failed");
    }

    setFeedbackSummary(
      aiJson?.feedbackSummary ||
        `Pronunciation: ${Math.round(Number(azureJson?.pronunciation || 0))}%`
    );

    setFeedbackTip(aiJson?.feedbackTip || "");
    setWeakPhonemes([]);
    setWeakWords(Array.isArray(aiJson?.weakWords) ? aiJson.weakWords.slice(0, 2) : []);
    setSpokenFeedbackText(aiJson?.spokenFeedbackText || "");
    setPendingNextAssistantText(aiJson?.nextAssistantText || "");
    setIsWaitingToContinue(true);
} catch (err) {
  const msg =
    err?.name === "AbortError"
      ? "Speech analysis timed out."
      : err?.message || "Speech analysis failed.";

  setError(msg);
  setFeedbackSummary(msg);
  setFeedbackTip("");
  setWeakPhonemes([]);
  setWeakWords([]);
  setSpokenFeedbackText("");
  setPendingNextAssistantText("");
  setIsWaitingToContinue(false);
} finally {
  setIsAnalyzing(false);
}
}
  async function startNewConversation() {
    try {
      try {
        realtimeRef.current?.disconnect?.();
      } catch {}

           setError("");
      setAssistantText("");
      setFeedbackSummary("");
      setFeedbackTip("");
      setSuggestedRepeat("");
      setWeakPhonemes([]);
      setWeakWords([]);
      setHasConversationStarted(false);
      setHoldScale(1);
      setIsAiSpeaking(false);
      setIsRecording(false);
      setIsWaitingToContinue(false);
      setIsStartingConversation(true);
      lastUserTranscriptRef.current = "";

      const rt = await createRealtimeConversation({
        accent,
        onRemoteAudio: () => {
          if (mountedRef.current) setIsAiSpeaking(true);
        },
        onMessage: (msg) => {
          console.log("[realtime msg]", msg);

          const type = msg?.type || "";

          const userTranscript = extractUserTranscriptFromMessage(msg);
          if (userTranscript) {
            lastUserTranscriptRef.current = userTranscript;
            console.log("[ConversationCoach] user transcript =", userTranscript);
          }

          if (type === "input_audio_buffer.speech_started") {
            userSpeechStartedRef.current = true;
            setIsAiSpeaking(false);
            setIsAnalyzing(false);
            setError("");
            setFeedbackSummary("");
          }

          if (type === "response.created") {
            if (suppressNextAssistantResponseRef.current) {
              realtimeRef.current?.interruptAssistant?.();
              setIsAiSpeaking(false);
              return;
            }

            setAssistantText("");
            setIsAiSpeaking(true);
            setIsAnalyzing(false);
          }

          const deltaText =
            typeof msg?.delta === "string"
              ? msg.delta
              : typeof msg?.text === "string"
              ? msg.text
              : typeof msg?.transcript === "string"
              ? msg.transcript
              : typeof msg?.part?.text === "string"
              ? msg.part.text
              : typeof msg?.part?.transcript === "string"
              ? msg.part.transcript
              : typeof msg?.item?.content?.[0]?.text === "string"
              ? msg.item.content[0].text
              : typeof msg?.item?.content?.[0]?.transcript === "string"
              ? msg.item.content[0].transcript
              : "";

          if (
            type === "response.output_text.delta" ||
            type === "response.text.delta" ||
            type === "response.audio_transcript.delta" ||
            type === "response.output_text.done" ||
            type === "response.text.done" ||
            type === "response.audio_transcript.done" ||
            type === "response.content_part.added" ||
            type === "response.content_part.done"
          ) {
            if (!suppressNextAssistantResponseRef.current && deltaText) {
              setAssistantText((prev) => {
                const next = `${prev || ""}${deltaText}`;
                return next.trimStart();
              });
            }
          }

                if (type === "response.done") {
  if (suppressNextAssistantResponseRef.current) {
    suppressNextAssistantResponseRef.current = false;
    setIsAiSpeaking(false);
    setIsAnalyzing(false);
    setError("");
    return;
  }

            const finalText =
              typeof msg?.response?.output?.[0]?.content?.[0]?.transcript === "string"
                ? msg.response.output[0].content[0].transcript
                : typeof msg?.response?.output?.[0]?.content?.[0]?.text === "string"
                ? msg.response.output[0].content[0].text
                : "";

            if (finalText) {
              setAssistantText(finalText);
            }

            setIsAiSpeaking(false);
            setIsAnalyzing(false);
          }

          if (
            type === "output_audio_buffer.stopped" ||
            type === "output_audio_buffer.cleared"
          ) {
            setIsAiSpeaking(false);
            setIsAnalyzing(false);
          }

                if (type === "error") {
  const serverMsg =
    msg?.error?.message || msg?.error?.code || "Realtime session error.";

  if (
    typeof serverMsg === "string" &&
    serverMsg.toLowerCase().includes("no active response found")
  ) {
    setError("");
    setIsAiSpeaking(false);
    setIsAnalyzing(false);
    return;
  }

            setError(serverMsg);
            setIsAiSpeaking(false);
            setIsAnalyzing(false);
          }
        },
        onError: (err) => {
          console.error("[realtime error]", err);
          setError(err?.message || "Realtime connection failed.");
          setIsAiSpeaking(false);
        },
      });

      realtimeRef.current = rt;
      await rt.connect();

      // Trigger the assistant to speak first
      const ok = rt.startAssistantGreeting?.();
      if (!ok) {
        setError("Failed to trigger assistant greeting.");
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to start realtime conversation.");
    } finally {
      if (mountedRef.current) setIsStartingConversation(false);
    }
  }

  async function handleEnterConversation() {
    setHasEnteredConversation(true);
    await startNewConversation();
  }

  function handleHoldStart(e) {
    e?.preventDefault?.();
    if (holdStartedRef.current) return;
    holdStartedRef.current = true;
    userSpeechStartedRef.current = false;
    suppressNextAssistantResponseRef.current = false;
    waitingForUserReleaseRef.current = true;
    lastUserTranscriptRef.current = "";

    const ok = realtimeRef.current?.startUserInput?.();
    if (!ok) {
      setError("Microphone is not ready.");
      holdStartedRef.current = false;
      return;
    }

    setIsAiSpeaking(false);
    setIsRecording(true);
    setIsAnalyzing(false);
    setIsWaitingToContinue(false);
    setHasConversationStarted(true);
    setError("");
    setFeedbackSummary("");
    setFeedbackTip("");
    setSuggestedRepeat("");
    setWeakPhonemes([]);
    setWeakWords([]);
    setHoldScale(1.08);
  }

  async function handleHoldEnd(e) {
    e?.preventDefault?.();
    if (!holdStartedRef.current) return;
    holdStartedRef.current = false;
    waitingForUserReleaseRef.current = false;

    const recording = await realtimeRef.current?.stopUserInput?.();

    setIsRecording(false);
    setHoldScale(1);

    if (!userSpeechStartedRef.current) {
      suppressNextAssistantResponseRef.current = true;
      setIsAnalyzing(false);
      setError("");
      setFeedbackTip("");
      setWeakPhonemes([]);
      setWeakWords([]);
      setFeedbackSummary("I didn’t hear anything. Hold the button and try again.");
      return;
    }

       suppressNextAssistantResponseRef.current = true;
    setIsWaitingToContinue(true);
    setIsAnalyzing(true);
    setFeedbackSummary("Analyzing your pronunciation...");
    setFeedbackTip("");
    setWeakPhonemes([]);
    setWeakWords([]);

    await analyzeUserTurn(recording);
  }

  useEffect(() => {
    async function endAnywhere() {
      if (!holdStartedRef.current) return;
      holdStartedRef.current = false;
      waitingForUserReleaseRef.current = false;

      const recording = await realtimeRef.current?.stopUserInput?.();

      setIsRecording(false);
      setHoldScale(1);

      if (!userSpeechStartedRef.current) {
        suppressNextAssistantResponseRef.current = true;
        setIsAnalyzing(false);
        setError("");
        setFeedbackTip("");
        setWeakPhonemes([]);
        setWeakWords([]);
        setFeedbackSummary("I didn’t hear anything. Hold the button and try again.");
        return;
      }

        suppressNextAssistantResponseRef.current = true;
      setIsWaitingToContinue(true);
      setIsAnalyzing(true);
      setFeedbackSummary("Analyzing your pronunciation...");
      setFeedbackTip("");
      setWeakPhonemes([]);
      setWeakWords([]);

      await analyzeUserTurn(recording);
    }

    window.addEventListener("pointerup", endAnywhere);
    window.addEventListener("pointercancel", endAnywhere);

    return () => {
      window.removeEventListener("pointerup", endAnywhere);
      window.removeEventListener("pointercancel", endAnywhere);
    };
  }, []);

  const circleBg = isRecording
    ? "radial-gradient(circle at 30% 30%, #4DA7FF 0%, #2196F3 40%, #1769C7 100%)"
    : "radial-gradient(circle at 30% 30%, #55AEFF 0%, #2196F3 48%, #1A73D9 100%)";

  const circleShadow = isRecording
    ? "0 0 0 14px rgba(33,150,243,0.16), 0 0 42px rgba(33,150,243,0.52), 0 18px 42px rgba(33,150,243,0.30)"
    : "0 12px 30px rgba(33,150,243,0.22)";
async function handleContinueAfterFeedback() {
  try {
    setError("");
    setIsWaitingToContinue(false);

    if (spokenFeedbackText) {
      setIsAiSpeaking(true);
      await speakText(spokenFeedbackText);
      setIsAiSpeaking(false);
    }

    if (pendingNextAssistantText) {
      setAssistantText(pendingNextAssistantText);
      setPendingNextAssistantText("");
    }
  } catch (err) {
    setIsAiSpeaking(false);
    setError(err?.message || "Failed to continue conversation.");
  }
}
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#F6FAFF",
        color: "#0F172A",
        display: "flex",
        flexDirection: "column",
        padding: "24px 18px 96px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          width: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        <div style={{ height: 12 }} />

        {!hasEnteredConversation ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 520,
                background: "#FFFFFF",
                border: "1px solid rgba(15,23,42,0.08)",
                boxShadow: "0 16px 42px rgba(15,23,42,0.08)",
                borderRadius: 28,
                padding: "28px 22px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  lineHeight: 1.1,
                  letterSpacing: -0.4,
                  marginBottom: 10,
                }}
              >
                AI Conversation Coach
              </div>

              <div
                style={{
                  fontSize: 16,
                  lineHeight: 1.5,
                  color: "#475569",
                  fontWeight: 700,
                  marginBottom: 22,
                }}
              >
                Start a live conversation and get pronunciation feedback while you speak.
              </div>

              <button
                type="button"
                onClick={handleEnterConversation}
                disabled={isStartingConversation}
                style={{
                  width: "100%",
                  height: 56,
                  borderRadius: 18,
                  border: "none",
                  background:
                    "linear-gradient(135deg, #3FA3FF 0%, #2196F3 60%, #1769C7 100%)",
                  color: "#FFFFFF",
                  fontWeight: 900,
                  fontSize: 17,
                  cursor: isStartingConversation ? "not-allowed" : "pointer",
                  boxShadow: "0 16px 34px rgba(33,150,243,0.30)",
                  opacity: isStartingConversation ? 0.78 : 1,
                }}
              >
                {isStartingConversation ? "Starting..." : "Start Conversation"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {assistantText ? (
              <div
                style={{
                  minHeight: 156,
                  borderRadius: 28,
                  background: "#FFFFFF",
                  border: "1px solid rgba(15,23,42,0.08)",
                  boxShadow: "0 16px 42px rgba(15,23,42,0.08)",
                  padding: "22px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    lineHeight: 1.45,
                    fontWeight: 800,
                    letterSpacing: -0.25,
                    color: "#0F172A",
                    maxWidth: 620,
                  }}
                >
                  {assistantText}
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 14, minHeight: 112 }}>
              {(feedbackSummary || weakPhonemes.length || weakWords.length || feedbackTip) ? (
                <div
                  style={{
                    background: "rgba(255,255,255,0.86)",
                    border: "1px solid rgba(15,23,42,0.08)",
                    boxShadow: "0 10px 28px rgba(15,23,42,0.05)",
                    borderRadius: 22,
                    padding: "14px 14px 12px",
                  }}
                >
                  {feedbackSummary ? (
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: 1.45,
                        fontWeight: 800,
                        color: "#334155",
                        marginBottom:
                          weakPhonemes.length || weakWords.length || suggestedRepeat ? 10 : 0,
                      }}
                    >
                      {feedbackSummary}
                    </div>
                  ) : null}

                  {weakPhonemes.length ? (
                    <div style={{ marginBottom: weakWords.length || suggestedRepeat ? 10 : 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: "#64748B",
                          marginBottom: 6,
                        }}
                      >
                        Weak sounds
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {weakPhonemes.map((p) => (
                          <span
                            key={`${p.label}-${p.score}`}
                            style={{
                              padding: "7px 10px",
                              borderRadius: 999,
                              background: "#F8FAFC",
                              border: "1px solid rgba(15,23,42,0.08)",
                              fontSize: 12,
                              fontWeight: 900,
                              color: "#94A3B8",
                            }}
                          >
                            {p.label} {Number.isFinite(p.score) ? `${p.score}%` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {weakWords.length ? (
                    <div style={{ marginBottom: suggestedRepeat ? 10 : 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: "#64748B",
                          marginBottom: 6,
                        }}
                      >
                        Weak words
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {weakWords.map((w) => (
                          <span
                            key={`${w.word}-${w.score}`}
                            style={{
                              padding: "7px 10px",
                              borderRadius: 999,
                              background: "#F8FAFC",
                              border: "1px solid rgba(15,23,42,0.08)",
                              fontSize: 12,
                              fontWeight: 900,
                              color: "#94A3B8",
                            }}
                          >
                            {w.word} {Number.isFinite(w.score) ? `${w.score}%` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                                                   {feedbackTip ? (
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: "#64748B",
                          marginBottom: 6,
                        }}
                      >
                        Tip
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                        {feedbackTip}
                      </div>
                    </div>
                  ) : null}

                  {isWaitingToContinue && !isAnalyzing ? (
                    <button
                      type="button"
                      onClick={handleContinueAfterFeedback}
                      style={{
                        marginTop: 12,
                        width: "100%",
                        height: 44,
                        borderRadius: 14,
                        border: "none",
                        background: "#2196F3",
                        color: "#FFFFFF",
                        fontSize: 14,
                        fontWeight: 900,
                        cursor: "pointer",
                        boxShadow: "0 10px 24px rgba(33,150,243,0.22)",
                      }}
                    >
                      Continue conversation
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 280,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <button
                  type="button"
                  onPointerDown={handleHoldStart}
                  onPointerUp={handleHoldEnd}
                  onPointerLeave={(e) => {
                    if (isRecording) handleHoldEnd(e);
                  }}
                  onPointerCancel={handleHoldEnd}
                  disabled={isBusy}
                  style={{
                    width: 184,
                    height: 184,
                    borderRadius: "50%",
                    border: "none",
                    background: circleBg,
                    color: "#FFFFFF",
                    cursor: isBusy ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${holdScale})`,
                    transition: "transform 120ms ease, box-shadow 120ms ease, background 120ms ease",
                    boxShadow: circleShadow,
                    opacity: isBusy ? 0.76 : 1,
                    touchAction: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                  }}
                >
                  <Mic size={56} strokeWidth={2.5} />
                </button>

                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    letterSpacing: -0.2,
                    color: "#2563EB",
                    textAlign: "center",
                  }}
                >
                  {isRecording
                    ? "Listening..."
                    : isAnalyzing
                    ? "Analyzing..."
                    : isStartingConversation
                    ? "Starting conversation..."
                    : isAiSpeaking
                    ? "Hold to interrupt and talk"
                    : "Hold to talk"}
                </div>

                {!!error && (
                  <div
                    style={{
                      maxWidth: 420,
                      textAlign: "center",
                      fontSize: 14,
                      fontWeight: 800,
                      lineHeight: 1.4,
                      color: "#B91C1C",
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={startNewConversation}
              disabled={isBusy || !hasConversationStarted}
              style={{
                width: "100%",
                height: 54,
                borderRadius: 18,
                border: "1px solid rgba(15,23,42,0.08)",
                background: isBusy || !hasConversationStarted ? "#E5E7EB" : "#FFFFFF",
                color: isBusy || !hasConversationStarted ? "#94A3B8" : "#0F172A",
                fontWeight: 900,
                fontSize: 16,
                cursor: isBusy || !hasConversationStarted ? "not-allowed" : "pointer",
                boxShadow:
                  isBusy || !hasConversationStarted
                    ? "none"
                    : "0 10px 28px rgba(15,23,42,0.05)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginTop: 8,
                opacity: isBusy || !hasConversationStarted ? 0.72 : 1,
              }}
            >
              <RotateCcw size={18} />
              New Conversation
            </button>
          </>
        )}
      </div>
      <audio ref={ttsAudioRef} />
    </div>
  );
}