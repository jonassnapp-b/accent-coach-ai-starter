// src/pages/ConversationCoach.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConversationBubble from "../components/conversation/ConversationBubble";
import ConversationComposer from "../components/conversation/ConversationComposer";
import PronunciationMiniCard from "../components/conversation/PronunciationMiniCard";
import {
  DEFAULT_SCENARIOS,
} from "../lib/conversationPrompts";
import {
  transcribeAudio,
  scorePronunciation,
  extractWeakPhonemes,
  extractWeakWords,
  generateCoachTurn,
  speakText,
} from "../lib/conversationCoach";
import { saveConversationSession } from "../lib/conversationStorage";
import { useSettings } from "../lib/settings-store.jsx";

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ConversationCoach() {
  const navigate = useNavigate();
  const { settings } = useSettings?.() || { settings: {} };

  const accent = settings?.accentDefault || "en_us";
  const level = "medium";

  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIOS[0].id);
  const scenario = useMemo(
    () => DEFAULT_SCENARIOS.find((s) => s.id === scenarioId) || DEFAULT_SCENARIOS[0],
    [scenarioId]
  );

  const [messages, setMessages] = useState([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [weakPhonemes, setWeakPhonemes] = useState([]);
  const [weakWords, setWeakWords] = useState([]);
  const [suggestedRepeat, setSuggestedRepeat] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const starter = scenario.starter;
    const initial = [{ id: createId(), role: "assistant", text: starter }];
    setMessages(initial);
    setTurnIndex(0);
    setWeakPhonemes([]);
    setWeakWords([]);
    setSuggestedRepeat("");

    speakText(starter, accent).catch(() => {});
  }, [scenarioId, accent]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, weakPhonemes, weakWords, suggestedRepeat]);

  async function startRecording() {
    if (isBusy || isRecording) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunksRef.current = [];

    mr.ondataavailable = (e) => {
      if (e.data?.size) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      try {
        setIsBusy(true);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        const tx = await transcribeAudio(blob, accent);
        const transcript = (tx?.transcript || "").trim();

        if (!transcript) {
          setMessages((prev) => [
            ...prev,
            {
              id: createId(),
              role: "coach",
              text: "I couldn’t hear a clear answer. Try again a bit slower.",
            },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          { id: createId(), role: "user", text: transcript },
        ]);

        const scoring = await scorePronunciation(blob, transcript, accent);
        const weakP = extractWeakPhonemes(scoring);
        const weakW = extractWeakWords(scoring);

        setWeakPhonemes(weakP);
        setWeakWords(weakW);

        const history = messages.map((m) => ({
          role: m.role === "coach" ? "assistant" : m.role,
          content: m.text,
        }));

        const reply = await generateCoachTurn({
          scenario: scenario.title,
          level,
          transcript,
          weakPhonemes: weakP,
          weakWords: weakW,
          turnIndex: turnIndex + 1,
          history,
        });

        setSuggestedRepeat(reply.suggested_repeat || "");

        if (reply.coach_feedback) {
          setMessages((prev) => [
            ...prev,
            {
              id: createId(),
              role: "coach",
              text: reply.coach_feedback,
            },
          ]);
        }

        if (reply.assistant_reply) {
          setMessages((prev) => [
            ...prev,
            {
              id: createId(),
              role: "assistant",
              text: reply.assistant_reply,
            },
          ]);

          const spokenText = [reply.coach_feedback, reply.assistant_reply]
            .filter(Boolean)
            .join(" ");

          await speakText(spokenText, accent).catch(() => {});
        }

        setTurnIndex((n) => n + 1);

        saveConversationSession({
          id: createId(),
          scenarioId,
          accent,
          createdAt: Date.now(),
          transcript,
          weakPhonemes: weakP,
          weakWords: weakW,
        });
      } catch (err) {
        console.error(err);
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "coach",
            text: "Something went wrong. Please try again.",
          },
        ]);
      } finally {
        setIsBusy(false);
        stopTracks();
      }
    };

    mediaRecorderRef.current = mr;
    mr.start();
    setIsRecording(true);
  }

  function stopTracks() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
          position: "sticky",
          top: 0,
          background: "#FFFFFF",
          zIndex: 20,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 14,
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          ← Back
        </button>

        <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10 }}>
          AI Conversation Coach
        </div>

        <select
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid rgba(15,23,42,0.12)",
            padding: "12px 14px",
            fontSize: 15,
          }}
        >
          {DEFAULT_SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>

      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.map((m) => (
          <ConversationBubble
            key={m.id}
            role={m.role}
            text={m.text}
          />
        ))}

        <PronunciationMiniCard
          weakPhonemes={weakPhonemes}
          weakWords={weakWords}
          suggestedRepeat={suggestedRepeat}
        />
      </div>

      <ConversationComposer
        isRecording={isRecording}
        isBusy={isBusy}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
      />
    </div>
  );
}