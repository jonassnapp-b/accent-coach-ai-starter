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
  const defaultAccent = settings?.accentDefault === "en_br" ? "en_br" : "en_us";
const [selectedAccent, setSelectedAccent] = useState(defaultAccent);

  const [assistantText, setAssistantText] = useState("");
const [feedbackSummary, setFeedbackSummary] = useState("");
  const [hasEnteredConversation, setHasEnteredConversation] = useState(false);
  const [hasConversationStarted, setHasConversationStarted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [isPreparingFeedbackAudio, setIsPreparingFeedbackAudio] = useState(false);
const [isWorkingOnFeedback, setIsWorkingOnFeedback] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [error, setError] = useState("");
  const [holdScale, setHoldScale] = useState(1);
  const [isWaitingToContinue, setIsWaitingToContinue] = useState(false);
  const [pendingNextAssistantText, setPendingNextAssistantText] = useState("");
const [spokenFeedbackText, setSpokenFeedbackText] = useState("");

const [practiceWords, setPracticeWords] = useState([]);
const [currentPracticeIndex, setCurrentPracticeIndex] = useState(0);
const [isPracticeActive, setIsPracticeActive] = useState(false);
const [isPracticeRecording, setIsPracticeRecording] = useState(false);
const [isPracticeAnalyzing, setIsPracticeAnalyzing] = useState(false);
const [practiceFeedbackText, setPracticeFeedbackText] = useState("");
const [practiceLastScore, setPracticeLastScore] = useState(null);
const [practiceRecordingResult, setPracticeRecordingResult] = useState(null);

const ttsAudioRef = useRef(null);
const practiceHoldStartedRef = useRef(false);
  const realtimeRef = useRef(null);
  const mountedRef = useRef(true);
  const holdStartedRef = useRef(false);
  const userSpeechStartedRef = useRef(false);
  const suppressNextAssistantResponseRef = useRef(false);
  const waitingForUserReleaseRef = useRef(false);
  const lastUserTranscriptRef = useRef("");
  const feedbackBusyRef = useRef(false);
async function speakText(text) {
  const t = String(text || "").trim();
  if (!t) return;

  setIsPreparingFeedbackAudio(true);

  const base = getApiBase();

  const res = await fetch(`${base}/api/tts`, {
    
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
  text: t,
  accent: selectedAccent,
  rate: 1,
}),
  });
console.log("[ConversationCoach] tts status =", res.status);
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
a.volume = 1;
a.onplaying = () => {
  setIsPreparingFeedbackAudio(false);
  setIsWorkingOnFeedback(false);
};
a.onended = () => {
  setIsPreparingFeedbackAudio(false);
  URL.revokeObjectURL(url);
  resolve();
};
a.onerror = () => {
  setIsPreparingFeedbackAudio(false);
  URL.revokeObjectURL(url);
  reject(new Error("Failed to play TTS"));
};
a.play().catch((err) => {
  setIsPreparingFeedbackAudio(false);
  reject(err);
});
    } catch (err) {
      URL.revokeObjectURL(url);
      reject(err);
    }
  });
}
const isBusy = isStartingConversation;
const WEAK_WORD_THRESHOLD = 75;

const ACCENT_DIFFERENCE_NOTES = {
  water: {
    en_us: "In American English this often sounds more like wa-der with a softer middle sound.",
    en_br: "In British English this is usually said more like waw-tuh with a clear t sound."
  },
  better: {
    en_us: "In American English this often sounds more like be-der with a softer middle sound.",
    en_br: "In British English this usually keeps a clearer t sound: be-tuh."
  },
  schedule: {
    en_us: "In American English this usually starts with an sk sound.",
    en_br: "In British English this often starts with a sh sound."
  },
  tomato: {
    en_us: "In American English the middle usually sounds more like may.",
    en_br: "In British English the middle usually sounds more like mah."
  },
  garage: {
    en_us: "In American English this is often said guh-RAHZH.",
    en_br: "In British English this is often said GA-ridge."
  },
  either: {
    en_us: "In American English this is often said EE-ther.",
    en_br: "In British English this is often said EYE-ther."
  },
  neither: {
    en_us: "In American English this is often said NEE-ther.",
    en_br: "In British English this is often said NYE-ther."
  },
  vitamin: {
    en_us: "In American English this usually starts with VY.",
    en_br: "In British English this usually starts with VIH."
  },
  cant: {
    en_us: "In American English this usually has a short a sound.",
    en_br: "In British English this often has a longer ah sound."
  },
  dance: {
    en_us: "In American English this usually has a short a sound.",
    en_br: "In British English this often has a longer ah sound."
  },
  chance: {
    en_us: "In American English this usually has a short a sound.",
    en_br: "In British English this often has a longer ah sound."
  },
  answer: {
    en_us: "In American English this often keeps a flatter a sound.",
    en_br: "In British English this often has a broader ah sound."
  },
  class: {
    en_us: "In American English this usually has a short a sound.",
    en_br: "In British English this often has a longer ah sound."
  }
};

function normalizeWordKey(word = "") {
  return String(word || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function getAccentDifferenceNote(word, accent) {
  const key = normalizeWordKey(word);
  const note = ACCENT_DIFFERENCE_NOTES[key];
  if (!note) return "";
  return accent === "en_br" ? note.en_br : note.en_us;
}

function pickWeakPracticeWords(words = []) {
  return [...words]
    .filter((w) => {
      const word = String(w?.word || "").trim();
      const score = Number(w?.accuracyScore ?? 0);
      return word && Number.isFinite(score) && score > 0 && score < WEAK_WORD_THRESHOLD;
    })
    .sort((a, b) => Number(a?.accuracyScore ?? 0) - Number(b?.accuracyScore ?? 0))
    .slice(0, 2)
    .map((w) => ({
      word: String(w.word || "").trim(),
      accuracyScore: Number(w.accuracyScore ?? 0),
      phonemes: Array.isArray(w.phonemes) ? w.phonemes : [],
      accentNote: getAccentDifferenceNote(w.word, selectedAccent),
    }));
}
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      try {
        realtimeRef.current?.disconnect?.();
      } catch {}
    };
  }, []);
useEffect(() => {
  feedbackBusyRef.current = isAnalyzing || isPreparingFeedbackAudio;
}, [isAnalyzing, isPreparingFeedbackAudio]);

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
function buildPracticeFeedback(wordObj, score) {
  const safeWord = String(wordObj?.word || "").trim();
  const phonemes = Array.isArray(wordObj?.phonemes) ? wordObj.phonemes : [];
  const weakestPhoneme = [...phonemes]
    .filter((p) => Number.isFinite(Number(p?.accuracyScore)))
    .sort((a, b) => Number(a?.accuracyScore ?? 0) - Number(b?.accuracyScore ?? 0))[0];

  if (score >= WEAK_WORD_THRESHOLD) {
    return `Much better. "${safeWord}" sounded clear enough now.`;
  }

  if (weakestPhoneme?.phoneme) {
    return `Better, but "${safeWord}" still needs work. Focus especially on the ${weakestPhoneme.phoneme} sound.`;
  }

  return `Better, but "${safeWord}" still needs a cleaner pronunciation.`;
}

async function analyzeUserTurn(recording) {
  if (!recording?.base64) {
setIsAnalyzing(false);
setIsWorkingOnFeedback(false);
setFeedbackSummary("I didn’t hear anything. Hold the button and try again.");
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
  accent: selectedAccent,
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
setSpokenFeedbackText("");
setPendingNextAssistantText("");
setIsWaitingToContinue(false);
setIsAnalyzing(false);
setIsWorkingOnFeedback(false);
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
  transcript: userTranscript,
  accent: selectedAccent,
  scores: {
    overallAccuracy: azureJson?.overallAccuracy,
    fluency: azureJson?.fluency,
    completeness: azureJson?.completeness,
    pronunciation: azureJson?.pronunciation,
    prosody: azureJson?.prosody,
    words: azureJson?.words,
    raw: azureJson?.raw,
  },
}),
    signal: aiController.signal,
  });
} finally {
  clearTimeout(aiTimeout);
}

    const aiJson = await aiRes.json().catch(() => ({}));
    console.log("[ConversationCoach] spokenFeedbackText =", aiJson?.spokenFeedbackText);
console.log("[ConversationCoach] ai status =", aiRes.status, aiRes.url);
console.log("[ConversationCoach] ai json =", aiJson);
    if (!aiRes.ok) {
      throw new Error(aiJson?.error || "AI feedback failed");
    }

setFeedbackSummary("");

const spokenText = String(aiJson?.spokenFeedbackText || "").trim();
setSpokenFeedbackText(spokenText);
setPendingNextAssistantText(aiJson?.nextAssistantText || "");

const weakPracticeWords = pickWeakPracticeWords(Array.isArray(azureJson?.words) ? azureJson.words : []);

if (spokenText) {
  setIsAnalyzing(false);
  setIsPreparingFeedbackAudio(true);
  setIsAiSpeaking(true);

  await speakText(spokenText);

  setIsAiSpeaking(false);
  setIsPreparingFeedbackAudio(false);
} else {
  setIsAnalyzing(false);
  setIsWorkingOnFeedback(false);
}

const startedPractice = startPracticeFlowFromWords(weakPracticeWords);
setIsWaitingToContinue(!startedPractice);
} catch (err) {
  const msg =
    err?.name === "AbortError"
      ? "Speech analysis timed out."
      : err?.message || "Speech analysis failed.";

setError(msg);
setFeedbackSummary(msg);
setSpokenFeedbackText("");
setPendingNextAssistantText("");
setIsWorkingOnFeedback(false);
setIsWaitingToContinue(false);
} finally {
}
}
async function analyzePracticeWord(recording, practiceWord) {
  if (!recording?.base64 || !practiceWord?.word) {
    setPracticeFeedbackText("I didn’t hear anything. Try that word again.");
    setIsPracticeAnalyzing(false);
    return;
  }

  try {
    const base = getApiBase();

   const azureRes = await fetch(`${base}/api/azure-pronunciation`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    audioBase64: recording.base64,
    mime: recording.mimeType || "audio/webm",
    accent: selectedAccent,
    referenceText: practiceWord.word,
  }),
});

    const azureJson = await azureRes.json().catch(() => ({}));
    if (!azureRes.ok) {
      throw new Error(azureJson?.error || "Practice pronunciation failed");
    }

    const matchedWord =
      (Array.isArray(azureJson?.words) ? azureJson.words : []).find((w) =>
        normalizeWordKey(w?.word) === normalizeWordKey(practiceWord.word)
      ) ||
      (Array.isArray(azureJson?.words) ? azureJson.words[0] : null);

    const score = Number(matchedWord?.accuracyScore ?? 0);
    setPracticeLastScore(score);
    setPracticeRecordingResult(matchedWord || null);
    setPracticeFeedbackText(buildPracticeFeedback(practiceWord, score));
  } catch (err) {
    setPracticeFeedbackText(err?.message || "Practice analysis failed.");
    setPracticeLastScore(null);
    setPracticeRecordingResult(null);
  } finally {
    setIsPracticeAnalyzing(false);
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
setHasConversationStarted(false);
setHoldScale(1);
setIsAiSpeaking(false);
setIsRecording(false);
setIsWaitingToContinue(false);
setSpokenFeedbackText("");
setPendingNextAssistantText("");
setIsStartingConversation(true);
lastUserTranscriptRef.current = "";

console.log("[ConversationCoach] starting realtime with accent =", selectedAccent);
   const rt = await createRealtimeConversation({
  accent: selectedAccent,
onRemoteAudio: () => {
  if (!mountedRef.current) return;
  if (selectedAccent === "en_br") return;
  setIsAiSpeaking(true);
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
 if (!feedbackBusyRef.current) {
  setIsAnalyzing(false);
}
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

  if (selectedAccent === "en_br" && finalText) {
    setIsAnalyzing(false);
    setIsAiSpeaking(true);

    speakText(finalText)
      .then(() => {
        setIsAiSpeaking(false);
      })
      .catch((err) => {
        console.error("[ConversationCoach] british TTS playback failed", err);
        setError(err?.message || "British TTS playback failed.");
        setIsAiSpeaking(false);
      });

    return;
  }

  setIsAiSpeaking(false);
  setIsAnalyzing(false);
}

         if (
  type === "output_audio_buffer.stopped" ||
  type === "output_audio_buffer.cleared"
) {
  setIsAiSpeaking(false);
 if (!feedbackBusyRef.current) {
  setIsAnalyzing(false);
}
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
 if (!feedbackBusyRef.current) {
  setIsAnalyzing(false);
}
  return;
}

          setError(serverMsg);
setIsAiSpeaking(false);
if (!feedbackBusyRef.current) {
  setIsAnalyzing(false);
}
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
setIsPreparingFeedbackAudio(false);
setIsWorkingOnFeedback(false);
setIsWaitingToContinue(false);
setHasConversationStarted(true);
setError("");
setFeedbackSummary("");
setSpokenFeedbackText("");
setPendingNextAssistantText("");
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
setFeedbackSummary("I didn’t hear anything. Hold the button and try again.");
      return;
    }

       suppressNextAssistantResponseRef.current = true;
  setIsWaitingToContinue(true);
setIsAnalyzing(true);
setIsPreparingFeedbackAudio(false);
setIsWorkingOnFeedback(true);
setFeedbackSummary("Analyzing your pronunciation...");

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
setIsAnalyzing(false);
setIsWorkingOnFeedback(false);
setError("");
setFeedbackSummary("I didn’t hear anything. Hold the button and try again.");
        return;
      }

        suppressNextAssistantResponseRef.current = true;
     setIsWaitingToContinue(true);
setIsAnalyzing(true);
setIsPreparingFeedbackAudio(false);
setIsWorkingOnFeedback(true);
setFeedbackSummary("Analyzing your pronunciation...");

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
function startPracticeFlowFromWords(words = []) {
  if (!Array.isArray(words) || words.length === 0) return false;

  setIsWaitingToContinue(false);
  setPracticeWords(words);
  setCurrentPracticeIndex(0);
  setIsPracticeActive(true);
  setIsPracticeRecording(false);
  setIsPracticeAnalyzing(false);
  setPracticeFeedbackText("");
  setPracticeLastScore(null);
  setPracticeRecordingResult(null);
  return true;
}

function handleSkipPractice() {
  setIsPracticeActive(false);
  setPracticeWords([]);
  setCurrentPracticeIndex(0);
  setPracticeFeedbackText("");
  setPracticeLastScore(null);
  setPracticeRecordingResult(null);
}

function handleContinueFromPracticeWord() {
  const isLast = currentPracticeIndex >= practiceWords.length - 1;

  if (isLast) {
    setIsPracticeActive(false);
    setPracticeWords([]);
    setCurrentPracticeIndex(0);
    setPracticeFeedbackText("");
    setPracticeLastScore(null);
    setPracticeRecordingResult(null);
    return;
  }

  setCurrentPracticeIndex((prev) => prev + 1);
  setPracticeFeedbackText("");
  setPracticeLastScore(null);
  setPracticeRecordingResult(null);
}

async function handlePlayPracticeWord() {
  const currentWord = practiceWords[currentPracticeIndex];
  if (!currentWord?.word) return;
  try {
    setIsAiSpeaking(true);
    await speakText(currentWord.word);
    setIsAiSpeaking(false);
  } catch (err) {
    setIsAiSpeaking(false);
    setError(err?.message || "Failed to play practice word.");
  }
}

async function handlePracticeHoldStart(e) {
  e?.preventDefault?.();
  if (practiceHoldStartedRef.current) return;
  practiceHoldStartedRef.current = true;

  const ok = await realtimeRef.current?.startPracticeRecording?.();
  if (!ok) {
    practiceHoldStartedRef.current = false;
    setError("Microphone is not ready.");
    return;
  }

  setIsPracticeRecording(true);
  setPracticeFeedbackText("");
  setPracticeLastScore(null);
  setPracticeRecordingResult(null);
}

async function handlePracticeHoldEnd(e) {
  e?.preventDefault?.();
  if (!practiceHoldStartedRef.current) return;
  practiceHoldStartedRef.current = false;

  const recording = await realtimeRef.current?.stopPracticeRecording?.();
  setIsPracticeRecording(false);
  setIsPracticeAnalyzing(true);

  await analyzePracticeWord(recording, practiceWords[currentPracticeIndex]);
}

function handlePracticeTryAgain() {
  setPracticeFeedbackText("");
  setPracticeLastScore(null);
  setPracticeRecordingResult(null);
}
async function handleContinueAfterFeedback() {
  try {
    setError("");
    setIsWaitingToContinue(false);

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
<div
  style={{
    marginBottom: 16,
    display: "flex",
    gap: 10,
  }}
>
  <button
    type="button"
    onClick={() => setSelectedAccent("en_us")}
    disabled={isStartingConversation}
    style={{
      flex: 1,
      height: 46,
      borderRadius: 16,
      border: selectedAccent === "en_us" ? "none" : "1px solid rgba(15,23,42,0.08)",
      background: selectedAccent === "en_us" ? "#2196F3" : "#FFFFFF",
      color: selectedAccent === "en_us" ? "#FFFFFF" : "#0F172A",
      fontSize: 14,
      fontWeight: 900,
      cursor: isStartingConversation ? "not-allowed" : "pointer",
      boxShadow: selectedAccent === "en_us" ? "0 10px 24px rgba(33,150,243,0.22)" : "none",
      opacity: isStartingConversation ? 0.7 : 1,
    }}
  >
    American
  </button>

  <button
    type="button"
    onClick={() => setSelectedAccent("en_br")}
    disabled={isStartingConversation}
    style={{
      flex: 1,
      height: 46,
      borderRadius: 16,
      border: selectedAccent === "en_br" ? "none" : "1px solid rgba(15,23,42,0.08)",
      background: selectedAccent === "en_br" ? "#2196F3" : "#FFFFFF",
      color: selectedAccent === "en_br" ? "#FFFFFF" : "#0F172A",
      fontSize: 14,
      fontWeight: 900,
      cursor: isStartingConversation ? "not-allowed" : "pointer",
      boxShadow: selectedAccent === "en_br" ? "0 10px 24px rgba(33,150,243,0.22)" : "none",
      opacity: isStartingConversation ? 0.7 : 1,
    }}
  >
    British
  </button>
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
{isPracticeActive && practiceWords[currentPracticeIndex] ? (
  <div
    style={{
      marginTop: 14,
      borderRadius: 28,
      background: "#FFFFFF",
      border: "1px solid rgba(15,23,42,0.08)",
      boxShadow: "0 16px 42px rgba(15,23,42,0.08)",
      padding: "20px 18px",
      transform: "scale(1)",
      opacity: 1,
      transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease",
    }}
  >
    <div
      style={{
        fontSize: 13,
        fontWeight: 900,
        color: "#2563EB",
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      Practice word {currentPracticeIndex + 1} of {practiceWords.length}
    </div>

    <div
      style={{
        fontSize: 28,
        fontWeight: 900,
        color: "#0F172A",
        letterSpacing: -0.3,
        marginBottom: 8,
      }}
    >
      {practiceWords[currentPracticeIndex].word}
    </div>

    {practiceWords[currentPracticeIndex].accentNote ? (
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.45,
          color: "#475569",
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {practiceWords[currentPracticeIndex].accentNote}
      </div>
    ) : null}

    <div
      style={{
        display: "flex",
        gap: 10,
        marginBottom: 14,
      }}
    >
      <button
        type="button"
        onClick={handlePlayPracticeWord}
     style={{
  flex: 1,
  height: 46,
  borderRadius: 16,
  border: "1px solid rgba(15,23,42,0.08)",
  background: "#FFFFFF",
  color: "#0F172A",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
}}
      >
        Hear word
      </button>

      <button
        type="button"
        onClick={handleSkipPractice}
        style={{
          flex: 1,
          height: 46,
          borderRadius: 16,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "#FFFFFF",
          color: "#0F172A",
          fontSize: 15,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        Skip practice
      </button>
    </div>

    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: 12,
      }}
    >
      <button
        type="button"
        onPointerDown={handlePracticeHoldStart}
        onPointerUp={handlePracticeHoldEnd}
        onPointerLeave={(e) => {
          if (isPracticeRecording) handlePracticeHoldEnd(e);
        }}
        onPointerCancel={handlePracticeHoldEnd}
        style={{
          width: 96,
          height: 96,
          borderRadius: "50%",
          border: "none",
          background: "radial-gradient(circle at 30% 30%, #55AEFF 0%, #2196F3 48%, #1A73D9 100%)",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 12px 30px rgba(33,150,243,0.22)",
          cursor: "pointer",
          transform: isPracticeRecording ? "scale(1.05)" : "scale(1)",
          transition: "transform 120ms ease",
          touchAction: "none",
        }}
      >
        <Mic size={32} strokeWidth={2.5} />
      </button>
    </div>

    <div
      style={{
        textAlign: "center",
        fontSize: 14,
        fontWeight: 900,
        color: "#2563EB",
        marginBottom: 12,
      }}
    >
      {isPracticeRecording
        ? "Recording word..."
        : isPracticeAnalyzing
        ? "Checking word..."
        : "Hold to say this word"}
    </div>

    {practiceFeedbackText ? (
      <div
        style={{
          borderRadius: 18,
          background: "#F8FBFF",
          border: "1px solid rgba(33,150,243,0.10)",
          padding: "14px 14px",
          fontSize: 15,
          lineHeight: 1.5,
          color: "#0F172A",
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {practiceFeedbackText}
      </div>
    ) : null}

    {practiceLastScore !== null ? (
      <div
        style={{
          fontSize: 13,
          fontWeight: 900,
          color: practiceLastScore >= WEAK_WORD_THRESHOLD ? "#15803D" : "#B45309",
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        Score: {practiceLastScore}
      </div>
    ) : null}

    <div
      style={{
        display: "flex",
        gap: 10,
      }}
    >
      <button
        type="button"
        onClick={handlePracticeTryAgain}
        style={{
          flex: 1,
          height: 46,
          borderRadius: 16,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "#FFFFFF",
          color: "#0F172A",
          fontSize: 15,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        Try again
      </button>

      <button
        type="button"
        onClick={handleContinueFromPracticeWord}
        style={{
          flex: 1,
          height: 46,
          borderRadius: 16,
          border: "none",
          background: "#2196F3",
          color: "#FFFFFF",
          fontSize: 15,
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 10px 24px rgba(33,150,243,0.22)",
        }}
      >
        Continue
      </button>
    </div>
  </div>
) : null}


<div style={{ marginTop: 14, minHeight: 64 }}>
  {isWaitingToContinue && !isWorkingOnFeedback && !isPracticeActive ? (
    <button
      type="button"
      onClick={handleContinueAfterFeedback}
      style={{
        width: "100%",
        height: 52,
        borderRadius: 18,
        border: "none",
        background: "#2196F3",
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: 900,
        cursor: "pointer",
        boxShadow: "0 10px 24px rgba(33,150,243,0.22)",
      }}
    >
      Continue conversation
    </button>
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
                  disabled={isBusy || isPracticeActive}
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  }}
>
{isPracticeActive ? (
  "Practice this word"
) : isRecording ? (
  "Listening..."
) : isWorkingOnFeedback ? (
  <>
    <span
      style={{
        width: 16,
        height: 16,
        border: "2px solid rgba(37,99,235,0.22)",
        borderTop: "2px solid #2563EB",
        borderRadius: "50%",
        display: "inline-block",
        animation: "conversationCoachSpin 0.8s linear infinite",
      }}
    />
    <span>Working on your feedback...</span>
  </>
) : isStartingConversation ? (
  "Starting conversation..."
) : isAiSpeaking ? (
  "Hold to interrupt and talk"
) : (
  "Hold to talk"
)}
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
<style>{`
  @keyframes conversationCoachSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`}</style>
    </div>
  );
}