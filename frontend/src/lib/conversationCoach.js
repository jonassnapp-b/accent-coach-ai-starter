// src/lib/conversationCoach.js

import { SYSTEM_PROMPT, buildConversationUserPrompt } from "./conversationPrompts";

const API_BASE =
  import.meta?.env?.VITE_API_BASE?.replace(/\/$/, "") || "";

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export async function transcribeAudio(audioBlob, accent = "en_us") {
  const fd = new FormData();
  fd.append("file", audioBlob, "conversation.webm");
  fd.append("accent", accent);

  const res = await fetch(`${API_BASE}/api/analyze-speech`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) throw new Error("Failed to transcribe audio");
  return safeJson(res);
}

export async function scorePronunciation(audioBlob, referenceText, accent = "en_us") {
  const fd = new FormData();
  fd.append("file", audioBlob, "conversation.webm");
  fd.append("accent", accent);

  if (referenceText) {
    fd.append("referenceText", referenceText);
    fd.append("refText", referenceText);
    fd.append("text", referenceText);
  }

  const res = await fetch(`${API_BASE}/api/analyze-speech`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) throw new Error("Failed to score pronunciation");
  return safeJson(res);
}

export function extractWeakPhonemes(scoreJson) {
  const phonemes = Array.isArray(scoreJson?.phonemes) ? scoreJson.phonemes : [];
  return phonemes
    .map((p) => ({
      label: p.phoneme || p.label || p.phone || "",
      score: Math.round(
        Number(
          p.score ??
            p.accuracy_score ??
            p.pronunciation ??
            p.accuracy ??
            0
        )
      ),
    }))
    .filter((p) => p.label)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
}

export function extractWeakWords(scoreJson) {
  const words = Array.isArray(scoreJson?.words) ? scoreJson.words : [];
  return words
    .map((w) => ({
      word: w.word || w.text || "",
      score: Math.round(
        Number(
          w.score ??
            w.accuracy_score ??
            w.pronunciation ??
            w.accuracy ??
            0
        )
      ),
    }))
    .filter((w) => w.word)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
}

export async function generateCoachTurn({
  scenario,
  level,
  transcript,
  weakPhonemes,
  weakWords,
  turnIndex,
  history = [],
}) {
  const payload = {
    system: SYSTEM_PROMPT,
    history,
    user: buildConversationUserPrompt({
      scenario,
      level,
      transcript,
      weakPhonemes,
      weakWords,
      turnIndex,
    }),
  };

const res = await fetch(`${API_BASE}/api/conv/next`, {
        method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed to generate conversation reply");

  const data = await safeJson(res);

  return {
    coach_feedback: data?.coach_feedback || "Nice answer.",
    assistant_reply: data?.assistant_reply || "Tell me a little more.",
    suggested_repeat: data?.suggested_repeat || "",
  };
}

export async function speakText(text, accent = "en_us") {
  const res = await fetch(`${API_BASE}/api/align-tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, accent }),
  });

  if (!res.ok) throw new Error("Failed to synthesize speech");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  await new Promise((resolve, reject) => {
    audio.onended = resolve;
    audio.onerror = reject;
    audio.play().catch(reject);
  });

  URL.revokeObjectURL(url);
}