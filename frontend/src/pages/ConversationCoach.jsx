// src/pages/ConversationCoach.jsx

import React, { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import { createRealtimeConversation } from "../lib/realtimeConversation.js";

export default function ConversationCoach() {
  const { settings } = useSettings?.() || { settings: {} };
  const accent = settings?.accentDefault || "en_us";

  const [assistantText, setAssistantText] = useState("");
  const [feedbackSummary, setFeedbackSummary] = useState("");
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

  const realtimeRef = useRef(null);
  const mountedRef = useRef(true);
  const holdStartedRef = useRef(false);

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

  async function startNewConversation() {
    try {
      try {
        realtimeRef.current?.disconnect?.();
      } catch {}

      setError("");
      setAssistantText("");
      setFeedbackSummary("");
      setSuggestedRepeat("");
      setWeakPhonemes([]);
      setWeakWords([]);
      setHasConversationStarted(false);
      setHoldScale(1);
      setIsAiSpeaking(false);
      setIsRecording(false);
      setIsStartingConversation(true);

      const rt = await createRealtimeConversation({
        accent,
        onRemoteAudio: () => {
          if (mountedRef.current) setIsAiSpeaking(true);
        },
        onMessage: (msg) => {
          console.log("[realtime msg]", msg);

          const type = msg?.type || "";

          if (type === "response.created") {
            setAssistantText("");
            setIsAiSpeaking(true);
          }

         if (
  type === "response.audio_transcript.done" ||
  type === "response.output_text.done" ||
  type === "response.text.done"
) {
  const finalText = String(
    msg?.transcript || msg?.text || msg?.delta || ""
  ).trim();

  if (finalText) {
    setAssistantText((prev) => (prev ? prev : finalText));
  }
}

          if (type === "input_audio_buffer.speech_started") {
            setIsAiSpeaking(false);
          }

          if (
            type === "response.done" ||
            type === "output_audio_buffer.stopped" ||
            type === "output_audio_buffer.cleared"
          ) {
            setIsAiSpeaking(false);
          }

          if (type === "error") {
            const serverMsg =
              msg?.error?.message || msg?.error?.code || "Realtime session error.";
            setError(serverMsg);
            setIsAiSpeaking(false);
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

    const ok = realtimeRef.current?.startUserInput?.();
    if (!ok) {
      setError("Microphone is not ready.");
      holdStartedRef.current = false;
      return;
    }

    setIsAiSpeaking(false);
    setIsRecording(true);
    setHasConversationStarted(true);
    setError("");
    setFeedbackSummary("");
    setSuggestedRepeat("");
    setWeakPhonemes([]);
    setWeakWords([]);
    setHoldScale(1.08);
  }

  function handleHoldEnd(e) {
    e?.preventDefault?.();
    if (!holdStartedRef.current) return;
    holdStartedRef.current = false;

    realtimeRef.current?.stopUserInput?.();

    setIsRecording(false);
    setHoldScale(1);
    setFeedbackSummary("Analyzing your pronunciation...");
  }

  useEffect(() => {
    function endAnywhere() {
      if (!holdStartedRef.current) return;
      holdStartedRef.current = false;

      realtimeRef.current?.stopUserInput?.();

      setIsRecording(false);
      setHoldScale(1);
      setFeedbackSummary("Analyzing your pronunciation...");
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
              {(feedbackSummary || weakPhonemes.length || weakWords.length || suggestedRepeat) ? (
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

                  {suggestedRepeat ? (
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                      Try again: {suggestedRepeat}
                    </div>
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
    </div>
  );
}