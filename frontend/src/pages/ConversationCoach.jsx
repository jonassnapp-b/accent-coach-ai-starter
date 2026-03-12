// src/pages/ConversationCoach.jsx

import React, { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import { scorePronunciation } from "../lib/conversationCoach";

const API_BASE =
  (import.meta?.env?.VITE_API_BASE || "").replace(/\/+$/, "") ||
  window.location.origin.replace(/\/+$/, "");

const PRONUN_THRESHOLD = 85;

const SYSTEM_PROMPT = `
You are FluentUp Conversation Coach.

Your job is to run a natural real-time spoken conversation for accent practice.
This is NOT a scenarios page and NOT a chat bubble UI.
The user sees only your latest message on screen.

Rules:
- Sound natural, warm, conversational, and voice-friendly.
- Replies should usually be normal length: around 2-5 sentences.
- Keep the conversation moving.
- Remember the ongoing conversation context.
- After the user speaks, mention pronunciation improvements clearly.
- Mention all meaningful pronunciation issues you see, but do it naturally and compactly.
- If there are multiple weak sounds or words, summarize them clearly.
- Then continue the conversation with a relevant follow-up.
- The first message of a new conversation should ask what the user wants to talk about today.
- In that first message, offer many possible directions naturally, without calling them "scenarios".
- Never output markdown.
- Return valid JSON only.

Return this JSON shape:
{
  "assistant_reply": "the full text the AI should say on screen and aloud",
  "feedback_summary": "short pronunciation summary for the visual feedback area",
  "suggested_repeat": "a short word or phrase to repeat, or empty string"
}
`.trim();

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function safeJson(res) {
  const text = await res.text();
  const parsed = safeJsonParse(text);
  if (parsed) return parsed;
  throw new Error(text || `HTTP ${res.status}`);
}

function extractTranscript(scoreJson) {
  return String(
    scoreJson?.recognitionText ||
      scoreJson?.transcript ||
      scoreJson?.text ||
      scoreJson?.result?.recognitionText ||
      ""
  ).trim();
}

function getScore(obj) {
  const v =
    obj?.accuracyScore ??
    obj?.overallAccuracy ??
    obj?.accuracy ??
    obj?.pronunciation ??
    obj?.score ??
    obj?.overall ??
    obj?.pronunciationAccuracy ??
    obj?.accuracy_score;

  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function uniqByLowestScore(items, keyField) {
  const map = new Map();

  for (const item of items) {
    const key = String(item?.[keyField] || "").trim();
    if (!key) continue;

    const prev = map.get(key);
    const score = Number.isFinite(item?.score) ? item.score : -1;

    if (!prev) {
      map.set(key, item);
      continue;
    }

    const prevScore = Number.isFinite(prev?.score) ? prev.score : -1;
    if (score < prevScore) {
      map.set(key, item);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const as = Number.isFinite(a.score) ? a.score : -1;
    const bs = Number.isFinite(b.score) ? b.score : -1;
    return as - bs;
  });
}

function extractWeakWordsAll(scoreJson) {
  const words =
    (Array.isArray(scoreJson?.words) && scoreJson.words) ||
    (Array.isArray(scoreJson?.result?.words) && scoreJson.result.words) ||
    (Array.isArray(scoreJson?.data?.words) && scoreJson.data.words) ||
    [];

  const mapped = words
    .map((w) => ({
      word: String(w?.word || w?.text || "").trim(),
      score: getScore(w),
    }))
    .filter((w) => w.word && (w.score == null || w.score < PRONUN_THRESHOLD));

  return uniqByLowestScore(mapped, "word");
}

function extractWeakPhonemesAll(scoreJson) {
  const topLevel =
    (Array.isArray(scoreJson?.phonemes) && scoreJson.phonemes) ||
    (Array.isArray(scoreJson?.result?.phonemes) && scoreJson.result.phonemes) ||
    (Array.isArray(scoreJson?.data?.phonemes) && scoreJson.data.phonemes) ||
    [];

  const fromWords = (
    (Array.isArray(scoreJson?.words) && scoreJson.words) ||
    (Array.isArray(scoreJson?.result?.words) && scoreJson.result.words) ||
    (Array.isArray(scoreJson?.data?.words) && scoreJson.data.words) ||
    []
  ).flatMap((w) =>
    (Array.isArray(w?.phonemes) ? w.phonemes : []).map((p) => ({
      phoneme: p?.phoneme || p?.label || p?.phone || p?.ipa || p?.symbol || "",
      score: getScore(p),
    }))
  );

  const all = [...topLevel, ...fromWords]
    .map((p) => ({
      label: String(p?.phoneme || p?.label || p?.phone || p?.ipa || p?.symbol || "").trim().toUpperCase(),
      score: getScore(p),
    }))
    .filter((p) => p.label && (p.score == null || p.score < PRONUN_THRESHOLD));

  return uniqByLowestScore(all, "label");
}

function buildOpeningUserPrompt() {
  return `
Start a brand new open-ended voice conversation.

Requirements:
- Ask what the user wants to talk about today.
- Offer many possible directions naturally, such as work, study, travel, fitness, relationships, goals, daily life, movies, music, food, culture, technology, money, memories, or plans.
- Do NOT mention "scenarios".
- Make it sound like a real live conversation opener.
- No pronunciation feedback yet because the user has not spoken yet.
`.trim();
}

function buildTurnUserPrompt({ transcript, weakPhonemes, weakWords }) {
  const phonemeText = weakPhonemes.length
    ? weakPhonemes.map((p) => `${p.label} ${p.score ?? "?"}%`).join(", ")
    : "none";

  const wordText = weakWords.length
    ? weakWords.map((w) => `${w.word} ${w.score ?? "?"}%`).join(", ")
    : "none";

  return `
User transcript:
"${transcript}"

Pronunciation issues found:
Weak phonemes: ${phonemeText}
Weak words: ${wordText}

Respond naturally in a real conversation.
You must:
1. Briefly mention pronunciation improvements.
2. Mention all meaningful issues compactly.
3. Continue the conversation with a relevant follow-up.
4. Keep it voice-friendly and natural.
`.trim();
}

async function requestConversationTurn({ history, userPrompt }) {
  const res = await fetch(`${API_BASE}/api/conv/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: SYSTEM_PROMPT,
      history,
      user: userPrompt,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Conversation request failed");
  }

  const data = await safeJson(res);

  return {
    assistant_reply:
      String(
        data?.assistant_reply ||
          data?.reply ||
          data?.message ||
          "Tell me a little more."
      ).trim(),
    feedback_summary:
      String(data?.feedback_summary || data?.coach_feedback || "").trim(),
    suggested_repeat: String(data?.suggested_repeat || "").trim(),
  };
}

function scoreColor(score) {
  if (!Number.isFinite(score)) return "#94A3B8";
  if (score >= 85) return "#22C55E";
  if (score >= 70) return "#F59E0B";
  return "#EF4444";
}

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

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const aiAudioRef = useRef(null);
  const historyRef = useRef([]);
  const mountedRef = useRef(true);
  const holdStartedRef = useRef(false);

  const isBusy = isAnalyzing || isStartingConversation;

   useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      stopAiAudio();
      stopRecordingInternal(true);
      cleanupStream();
    };
  }, []);

  function cleanupStream() {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    streamRef.current = null;
  }

  function stopAiAudio() {
    try {
      const a = aiAudioRef.current;
      if (a) {
        a.pause();
        a.currentTime = 0;
        a.src = "";
      }
    } catch {}
    aiAudioRef.current = null;
    if (mountedRef.current) setIsAiSpeaking(false);
  }

  async function speakAssistantText(text) {
    const t = String(text || "").trim();
    if (!t) return;

    stopAiAudio();

    const res = await fetch(`${API_BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: t,
        accent: accent === "en_br" ? "en_br" : "en_us",
        rate: 1.0,
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

    const audio = new Audio(url);
    aiAudioRef.current = audio;

    setIsAiSpeaking(true);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (aiAudioRef.current === audio) aiAudioRef.current = null;
      if (mountedRef.current) setIsAiSpeaking(false);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (aiAudioRef.current === audio) aiAudioRef.current = null;
      if (mountedRef.current) setIsAiSpeaking(false);
    };

    await audio.play();
  }

  async function startNewConversation() {
    stopAiAudio();
    stopRecordingInternal(true);
    cleanupStream();

    setError("");
    setAssistantText("");
    setFeedbackSummary("");
    setSuggestedRepeat("");
    setWeakPhonemes([]);
    setWeakWords([]);
    setHasConversationStarted(false);
    setHoldScale(1);

    historyRef.current = [];
    setIsStartingConversation(true);

    try {
      const opener = await requestConversationTurn({
        history: [],
        userPrompt: buildOpeningUserPrompt(),
      });

      const nextText =
        opener?.assistant_reply ||
        "What would you like to talk about today? We can talk about work, study, travel, fitness, goals, daily life, movies, music, food, culture, technology, money, memories, or anything else you want.";

      setAssistantText(nextText);
      historyRef.current = [{ role: "assistant", content: nextText }];

      await speakAssistantText(nextText);
    } catch (err) {
      console.error(err);
      const fallback =
        "What would you like to talk about today? We can talk about work, study, travel, fitness, goals, daily life, movies, music, food, culture, technology, money, memories, or anything else you want.";
      setAssistantText(fallback);
      historyRef.current = [{ role: "assistant", content: fallback }];
      try {
        await speakAssistantText(fallback);
      } catch {}
    } finally {
      if (mountedRef.current) setIsStartingConversation(false);
    }
  }
  async function handleEnterConversation() {
    setHasEnteredConversation(true);
    await startNewConversation();
  }
  async function createRecorder() {
    cleanupStream();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    let options = {};
    if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options = { mimeType: "audio/webm;codecs=opus" };
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/webm" };
      }
    }

    let mr;
    try {
      mr = new MediaRecorder(stream, options);
    } catch {
      mr = new MediaRecorder(stream);
    }

    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data?.size) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: chunksRef.current?.[0]?.type || mr.mimeType || "audio/webm",
      });
      chunksRef.current = [];
      cleanupStream();
      await handleUserTurn(blob);
    };

    mediaRecorderRef.current = mr;
    return mr;
  }

  async function startRecordingInternal() {
    if (isBusy || isRecording) return;

    setError("");
    setHoldScale(1.08);

    stopAiAudio();

    try {
      const mr = await createRecorder();
      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      setHoldScale(1);
      setIsRecording(false);
      setError("Microphone access failed. Please try again.");
    }
  }

  function stopRecordingInternal(forceSilent = false) {
    setHoldScale(1);

    const mr = mediaRecorderRef.current;
    if (!mr) return;

    try {
      if (mr.state !== "inactive") {
        mr.stop();
      }
    } catch {
      cleanupStream();
    }

    mediaRecorderRef.current = null;

    if (!forceSilent && mountedRef.current) {
      setIsRecording(false);
    }
    if (forceSilent && mountedRef.current) {
      setIsRecording(false);
    }
  }

  async function handleUserTurn(audioBlob) {
    try {
      setIsRecording(false);
      setIsAnalyzing(true);
      setError("");

      const scoring = await scorePronunciation(audioBlob, "", accent);
      const transcript = extractTranscript(scoring);

      if (!transcript) {
        setError("I couldn’t hear a clear answer. Try again.");
        return;
      }
      setHasConversationStarted(true);
      const weakP = extractWeakPhonemesAll(scoring);
      const weakW = extractWeakWordsAll(scoring);

      setWeakPhonemes(weakP);
      setWeakWords(weakW);

      const history = [...historyRef.current, { role: "user", content: transcript }];

      const reply = await requestConversationTurn({
        history,
        userPrompt: buildTurnUserPrompt({
          transcript,
          weakPhonemes: weakP,
          weakWords: weakW,
        }),
      });

      const nextText = reply?.assistant_reply || "That was interesting. Tell me a little more.";
      const nextFeedback =
        reply?.feedback_summary ||
        (weakP.length || weakW.length
          ? "Focus on the weak sounds and words shown below."
          : "Nice clarity. Keep going.");

      setAssistantText(nextText);
      setFeedbackSummary(nextFeedback);
      setSuggestedRepeat(reply?.suggested_repeat || "");

      historyRef.current = [
        ...history,
        { role: "assistant", content: nextText },
      ];

      await speakAssistantText(nextText);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      if (mountedRef.current) {
        setIsAnalyzing(false);
      }
    }
  }

  async function handleHoldStart(e) {
    e?.preventDefault?.();
    if (holdStartedRef.current) return;
    holdStartedRef.current = true;
    await startRecordingInternal();
  }

  function handleHoldEnd(e) {
    e?.preventDefault?.();
    if (!holdStartedRef.current) return;
    holdStartedRef.current = false;
    stopRecordingInternal(false);
  }

  useEffect(() => {
    function endAnywhere() {
      if (!holdStartedRef.current) return;
      holdStartedRef.current = false;
      stopRecordingInternal(false);
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
                  background: "linear-gradient(135deg, #3FA3FF 0%, #2196F3 60%, #1769C7 100%)",
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
                        marginBottom: weakPhonemes.length || weakWords.length || suggestedRepeat ? 10 : 0,
                      }}
                    >
                      {feedbackSummary}
                    </div>
                  ) : null}

                  {weakPhonemes.length ? (
                    <div style={{ marginBottom: weakWords.length || suggestedRepeat ? 10 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#64748B", marginBottom: 6 }}>
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
                              color: scoreColor(p.score),
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
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#64748B", marginBottom: 6 }}>
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
                              color: scoreColor(w.score),
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
                boxShadow: isBusy || !hasConversationStarted ? "none" : "0 10px 28px rgba(15,23,42,0.05)",
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