// src/pages/ConversationCoach.jsx

import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Mic, RotateCcw, ChevronDown, ChevronRight, Check, X, ReceiptText } from "lucide-react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useSettings } from "../lib/settings-store.jsx";
import { createRealtimeConversation } from "../lib/realtimeConversation.js";
import { } from "../lib/onboarding.js";
import { useNavigate } from "react-router-dom";
import { useProStatus } from "../providers/PurchasesProvider.jsx";
import fluentUpLogo from "../assets/Logo_Arrow.png";
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

async function triggerButtonHaptic() {
  try {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
      return;
    }

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(10);
    }
  } catch {}
}

const TALK_DAILY_LIMIT_MS = 90000;
const TALK_DAILY_STORAGE_KEY = "fluentup_conversation_coach_daily_v1";

function getLocalDayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readDailyTalkUsage() {
  try {
    const raw = localStorage.getItem(TALK_DAILY_STORAGE_KEY);
    if (!raw) {
      return { dayKey: getLocalDayKey(), usedMs: 0 };
    }

    const parsed = JSON.parse(raw);
    const today = getLocalDayKey();

    if (parsed?.dayKey !== today) {
      return { dayKey: today, usedMs: 0 };
    }

    return {
      dayKey: today,
      usedMs: Math.max(0, Number(parsed?.usedMs || 0)),
    };
  } catch {
    return { dayKey: getLocalDayKey(), usedMs: 0 };
  }
}

function writeDailyTalkUsage(usedMs) {
  try {
    localStorage.setItem(
      TALK_DAILY_STORAGE_KEY,
      JSON.stringify({
        dayKey: getLocalDayKey(),
        usedMs: Math.max(0, Math.floor(Number(usedMs || 0))),
      })
    );
  } catch {}
}

function getRemainingDailyTalkMs() {
  const usage = readDailyTalkUsage();
  return Math.max(0, TALK_DAILY_LIMIT_MS - usage.usedMs);
}

function addDailyTalkUsage(msToAdd) {
  const usage = readDailyTalkUsage();
  const nextUsed = Math.min(TALK_DAILY_LIMIT_MS, usage.usedMs + Math.max(0, Number(msToAdd || 0)));
  writeDailyTalkUsage(nextUsed);
  return Math.max(0, TALK_DAILY_LIMIT_MS - nextUsed);
}
function AiSpeakingWaveform({ active }) {
  const bars = [0, 1, 2, 3, 4, 5, 6];

  return (
    <div
      aria-hidden="true"
     style={{
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  gap: 6,
  height: 44,
  marginTop: 10,
  opacity: 1,
  transform: "scale(1)",
}}
    >
      {bars.map((i) => (
       <span
  key={i}
  style={{
    display: "inline-block",
    width: 6,
    height: active ? 14 : 14,
    borderRadius: 999,
    background:
      "linear-gradient(180deg, rgba(85,174,255,1) 0%, rgba(33,150,243,1) 55%, rgba(23,105,199,1) 100%)",
    transformOrigin: "center bottom",
    willChange: "transform, opacity",
    animation: active
      ? `conversationCoachWave 0.9s ease-in-out ${i * 0.09}s infinite`
      : "none",
    boxShadow: active ? "0 4px 14px rgba(33,150,243,0.22)" : "none",
  }}
/>
      ))}
    </div>
  );
}
const ACCENT_SECTIONS = [
  {
    title: "English",
    options: [
      { value: "en_us", label: "American", flag: "🇺🇸" },
      { value: "en_br", label: "British", flag: "🇬🇧" },
    ],
  },
  {
    title: "Mandarin Chinese",
    options: [
      { value: "zh_cn", label: "Mandarin Chinese", flag: "🇨🇳" },
    ],
  },
  {
    title: "Japanese",
    options: [
      { value: "ja_jp", label: "Japanese", flag: "🇯🇵" },
    ],
  },
  {
    title: "Korean",
    options: [
      { value: "ko_kr", label: "Korean", flag: "🇰🇷" },
    ],
  },
  {
    title: "Spanish",
    options: [
      { value: "es_es", label: "Spanish", flag: "🇪🇸" },
    ],
  },
  {
    title: "German",
    options: [
      { value: "de_de", label: "German", flag: "🇩🇪" },
    ],
  },
  {
    title: "French",
    options: [
      { value: "fr_fr", label: "French", flag: "🇫🇷" },
    ],
  },
  {
    title: "Russian",
    options: [
      { value: "ru_ru", label: "Russian", flag: "🇷🇺" },
    ],
  },
  {
    title: "Arabic",
    options: [
      { value: "ar_sa", label: "Arabic", flag: "🇸🇦" },
    ],
  },
];

const ACCENT_OPTIONS = ACCENT_SECTIONS.flatMap((section) => section.options);



function getAccentOption(value) {
  return ACCENT_OPTIONS.find((item) => item.value === value) || ACCENT_OPTIONS[0];
}
const ACCENT_SHEET_OPEN_Y = 32;
const ACCENT_SHEET_CLOSE_MS = 280;
const ACCENT_SHEET_OPEN_TRANSITION = "transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 520ms ease";
const ACCENT_SHEET_CLOSE_TRANSITION = "transform 280ms cubic-bezier(0.4, 0, 1, 1), opacity 220ms ease";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}



function toScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function getMetricBarColor(key) {
  switch (key) {
    case "overall":
      return "#111111";
    case "pronunciation":
      return "#4F6BFF";
    case "fluency":
      return "#C94BFF";
    case "prosody":
      return "#F5A623";
    case "completeness":
      return "#FF6B6B";
    default:
      return "#111111";
  }
}

function buildConversationFeedbackMetrics(azureJson = {}) {
  const overall =
    azureJson?.overallAccuracy ??
    azureJson?.overall ??
    azureJson?.pronunciation ??
    azureJson?.accuracyScore ??
    azureJson?.accuracy_score ??
    azureJson?.scores?.overallAccuracy ??
    azureJson?.scores?.overall ??
    azureJson?.scores?.pronunciation;

  const pronunciation =
    azureJson?.pronunciation ??
    azureJson?.accuracyScore ??
    azureJson?.accuracy_score ??
    azureJson?.scores?.pronunciation ??
    azureJson?.scores?.accuracyScore ??
    azureJson?.scores?.accuracy_score ??
    overall;

  const fluency =
    azureJson?.fluency ??
    azureJson?.fluencyScore ??
    azureJson?.scores?.fluency ??
    azureJson?.scores?.fluencyScore;

  const prosody =
    azureJson?.prosody ??
    azureJson?.prosodyScore ??
    azureJson?.scores?.prosody ??
    azureJson?.scores?.prosodyScore;

  const completeness =
    azureJson?.completeness ??
    azureJson?.completenessScore ??
    azureJson?.scores?.completeness ??
    azureJson?.scores?.completenessScore;

  const metrics = [
    {
      key: "overall",
      label: "Overall",
      value: toScore(overall),
    },
    {
      key: "pronunciation",
      label: "Pronunciation",
      value: toScore(pronunciation),
    },
    {
      key: "fluency",
      label: "Fluency",
      value: toScore(fluency),
    },
    {
      key: "prosody",
      label: "Prosody",
      value: toScore(prosody),
    },
    {
      key: "completeness",
      label: "Completeness",
      value: toScore(completeness),
    },
  ];

  return metrics.filter((item) => item.value !== null);
}
export default function ConversationCoach() {
const nav = useNavigate();
const { settings, setSettings } = useSettings?.() || {
  settings: {},
  setSettings: () => {},
};
const { isPro } = useProStatus();
  const defaultAccent = settings?.accentDefault === "en_br" ? "en_br" : "en_us";
  const [selectedAccent, setSelectedAccent] = useState(defaultAccent);
  


const [isAccentMenuOpen, setIsAccentMenuOpen] = useState(false);

const [accentSheetTranslateY, setAccentSheetTranslateY] = useState(window.innerHeight);
const [isAccentSheetClosing, setIsAccentSheetClosing] = useState(false);
const accentSheetDragStartYRef = useRef(0);
const accentSheetDragStartTranslateYRef = useRef(0);
const accentSheetDraggingRef = useRef(false);
  useEffect(() => {
    setSelectedAccent(defaultAccent);
  }, [defaultAccent]);
useEffect(() => {
  function handleKeyDown(event) {
    if (event.key === "Escape") {
  setIsAccentMenuOpen(false);
}
  }

  document.addEventListener("keydown", handleKeyDown);

  return () => {
    document.removeEventListener("keydown", handleKeyDown);
  };
}, []);
  
  const [assistantText, setAssistantText] = useState("");
const [visibleAssistantText, setVisibleAssistantText] = useState("");
const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
const [messages, setMessages] = useState([]);
const [feedbackSummary, setFeedbackSummary] = useState("");
  const [hasEnteredConversation, setHasEnteredConversation] = useState(false);
  const [hasConversationStarted, setHasConversationStarted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [isPreparingFeedbackAudio, setIsPreparingFeedbackAudio] = useState(false);
const [isWorkingOnFeedback, setIsWorkingOnFeedback] = useState(false);
const [isAiSpeaking, setIsAiSpeaking] = useState(false);
const [isPendingAssistantPlayback, setIsPendingAssistantPlayback] = useState(false);
const [isTtsWaveformActive, setIsTtsWaveformActive] = useState(false);
const [isStartingConversation, setIsStartingConversation] = useState(false);
const [showConnectionFailedScreen, setShowConnectionFailedScreen] = useState(false);
const [error, setError] = useState("");
  const [holdScale, setHoldScale] = useState(1);
  const [isWaitingToContinue, setIsWaitingToContinue] = useState(false);
  const [pendingNextAssistantText, setPendingNextAssistantText] = useState("");
const [spokenFeedbackText, setSpokenFeedbackText] = useState("");
const [feedbackMetrics, setFeedbackMetrics] = useState([]);
const [practiceWords, setPracticeWords] = useState([]);
const [currentPracticeIndex, setCurrentPracticeIndex] = useState(0);
const [isPracticeActive, setIsPracticeActive] = useState(false);
const [isPracticeVisible, setIsPracticeVisible] = useState(false);
const [isPracticeRecording, setIsPracticeRecording] = useState(false);
const [isPracticeAnalyzing, setIsPracticeAnalyzing] = useState(false);
const [practiceFeedbackText, setPracticeFeedbackText] = useState("");
const [practiceLastScore, setPracticeLastScore] = useState(null);
const [practiceRecordingResult, setPracticeRecordingResult] = useState(null);
const [hasIntroGreetingFinished, setHasIntroGreetingFinished] = useState(false);

const ttsAudioRef = useRef(null);
const accentMenuRef = useRef(null);
const practiceHoldStartedRef = useRef(false);
  const realtimeRef = useRef(null);
  const mountedRef = useRef(true);
  const holdStartedRef = useRef(false);
  const userSpeechStartedRef = useRef(false);
  const suppressNextAssistantResponseRef = useRef(false);
  const waitingForUserReleaseRef = useRef(false);
  const lastUserTranscriptRef = useRef("");
  const feedbackBusyRef = useRef(false);
const activeTtsRef = useRef({ url: "", resolve: null });
const talkPaywallTimerRef = useRef(null);
const talkPaywallShownRef = useRef(false);
const talkSessionStartedAtRef = useRef(0);
const talkSessionLimitMsRef = useRef(0);
const pendingBritishTtsRef = useRef("");
const pendingPreparedTtsRef = useRef(null);
const introGreetingPlayingRef = useRef(false);
const exitRequestedRef = useRef(false);
function clearTalkPaywallTimer() {
  if (talkPaywallTimerRef.current) {
    clearTimeout(talkPaywallTimerRef.current);
    talkPaywallTimerRef.current = null;
  }
}
useEffect(() => {
  console.log("[ConversationCoach] render", {
    hasEnteredConversation,
    hasConversationStarted,
    assistantText,
    isAiSpeaking,
    isAnalyzing,
    isPreparingFeedbackAudio,
    isWorkingOnFeedback,
    error,
  });
}, [
  hasEnteredConversation,
  hasConversationStarted,
  assistantText,
  isAiSpeaking,
  isAnalyzing,
  isPreparingFeedbackAudio,
  isWorkingOnFeedback,
  error,
]);
function startTalkPaywallTimer() {
  clearTalkPaywallTimer();

  if (isPro) {
    talkPaywallShownRef.current = false;
    talkSessionStartedAtRef.current = 0;
    talkSessionLimitMsRef.current = 0;
    return;
  }

  const remainingMs = getRemainingDailyTalkMs();

  if (remainingMs <= 0) {
    talkPaywallShownRef.current = true;

    stopFeedbackTts();

    try {
      realtimeRef.current?.disconnect?.();
    } catch {}

    setIsAiSpeaking(false);
    setIsRecording(false);
    setIsAnalyzing(false);
    setIsPreparingFeedbackAudio(false);
    setIsWorkingOnFeedback(false);
    setIsWaitingToContinue(false);

    nav("/pro?src=talk_daily_limit&return=/conversation-coach");
    return;
  }

  talkSessionStartedAtRef.current = Date.now();
  talkSessionLimitMsRef.current = remainingMs;

  talkPaywallTimerRef.current = setTimeout(() => {
    if (talkPaywallShownRef.current) return;

    const startedAt = talkSessionStartedAtRef.current || Date.now();
    const elapsed = Math.min(
      talkSessionLimitMsRef.current || 0,
      Math.max(0, Date.now() - startedAt)
    );

    addDailyTalkUsage(elapsed);

    talkPaywallShownRef.current = true;

    stopFeedbackTts();

    try {
      realtimeRef.current?.disconnect?.();
    } catch {}

    setIsAiSpeaking(false);
    setIsRecording(false);
    setIsAnalyzing(false);
    setIsPreparingFeedbackAudio(false);
    setIsWorkingOnFeedback(false);
    setIsWaitingToContinue(false);

    nav("/pro?src=talk_daily_limit&return=/conversation-coach");
  }, remainingMs);
}
function finalizeDailyTalkSession() {
  if (isPro) {
    talkSessionStartedAtRef.current = 0;
    talkSessionLimitMsRef.current = 0;
    return;
  }

  if (!talkSessionStartedAtRef.current) return;

  const startedAt = talkSessionStartedAtRef.current;
  const maxAllowed = talkSessionLimitMsRef.current || 0;
  const elapsed = Math.min(maxAllowed, Math.max(0, Date.now() - startedAt));

  addDailyTalkUsage(elapsed);

  talkSessionStartedAtRef.current = 0;
  talkSessionLimitMsRef.current = 0;
}
function stopFeedbackTts() {
  const audio = ttsAudioRef.current;
  const active = activeTtsRef.current;

  try {
    if (audio) {
      audio.onplaying = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
    }
  } catch {}

  if (active?.url) {
    try {
      URL.revokeObjectURL(active.url);
    } catch {}
  }

  if (typeof active?.resolve === "function") {
    const resolve = active.resolve;
    activeTtsRef.current = { url: "", resolve: null };
    resolve(false);
  } else {
    activeTtsRef.current = { url: "", resolve: null };
  }

setIsAiSpeaking(false);
setIsPendingAssistantPlayback(false);
setIsTtsWaveformActive(false);
setIsPreparingFeedbackAudio(false);
setIsWorkingOnFeedback(false);

pendingBritishTtsRef.current = "";

if (pendingPreparedTtsRef.current?.url) {
  try {
    URL.revokeObjectURL(pendingPreparedTtsRef.current.url);
  } catch {}
}
pendingPreparedTtsRef.current = null;
}
async function prepareTtsAudio(text) {
  const t = String(text || "").trim();
  if (!t) return null;

  const base = getApiBase();

  const res = await fetch(`${base}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: t,
      language: selectedAccent,
      accent: selectedAccent,
      rate: 1,
    }),
  });

  console.log("[ConversationCoach] prepareTtsAudio status =", res.status);

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || "TTS failed");
  }

  const buf = await res.arrayBuffer();

  console.log("[ConversationCoach] prepareTtsAudio loaded", {
    bytes: buf.byteLength,
  });

  const mime = (res.headers.get("content-type") || "audio/mpeg").split(";")[0].trim();
  const blob = new Blob([buf], { type: mime });
  const url = URL.createObjectURL(blob);

  return { url, text: t };
}
async function speakText(text) {
  const t = String(text || "").trim();
  if (!t) return false;

  console.log("[ConversationCoach] speakText start", {
    text: t,
    selectedAccent,
  });

  let prepared = null;

  if (pendingPreparedTtsRef.current?.text === t && pendingPreparedTtsRef.current?.url) {
    prepared = pendingPreparedTtsRef.current;
    pendingPreparedTtsRef.current = null;
    console.log("[ConversationCoach] speakText using preloaded audio");
  } else {
    console.log("[ConversationCoach] speakText fetching fresh audio");
    prepared = await prepareTtsAudio(t);
  }

  if (!prepared?.url) {
    throw new Error("TTS audio missing");
  }

stopFeedbackTts();
setIsPreparingFeedbackAudio(true);
setIsTtsWaveformActive(true);

  return new Promise((resolve, reject) => {
    try {
      if (!ttsAudioRef.current) {
        ttsAudioRef.current = new Audio();
      }

      const a = ttsAudioRef.current;
      activeTtsRef.current = { url: prepared.url, resolve };

      a.src = prepared.url;
      a.volume = 1;

     a.onplaying = () => {
  console.log("[ConversationCoach] audio onplaying");
  setHasConversationStarted(true);
  setIsPendingAssistantPlayback(false);
  setIsPreparingFeedbackAudio(false);
  setIsWorkingOnFeedback(false);
};

a.onended = () => {
  console.log("[ConversationCoach] audio onended", {
    introGreeting: introGreetingPlayingRef.current,
  });
  console.log("[ConversationCoach] BEFORE intro-finish set", {
    hasIntroGreetingFinished,
    introGreetingPlaying: introGreetingPlayingRef.current,
    isPendingAssistantPlayback,
    isAiSpeaking,
    isPreparingFeedbackAudio,
  });
  try {
    URL.revokeObjectURL(prepared.url);
  } catch {}

  activeTtsRef.current = { url: "", resolve: null };

  setIsPendingAssistantPlayback(false);
  setIsTtsWaveformActive(false);
  setIsPreparingFeedbackAudio(false);
  setIsAiSpeaking(false);
  setIsWorkingOnFeedback(false);


  

  resolve(true);
};

    a.onerror = () => {
  console.log("[ConversationCoach] audio onerror");
  try {
    URL.revokeObjectURL(prepared.url);
  } catch {}
  activeTtsRef.current = { url: "", resolve: null };
  setIsPendingAssistantPlayback(false);
  setIsTtsWaveformActive(false);
  setIsPreparingFeedbackAudio(false);
  setIsTranscriptOpen(false);
  reject(new Error("Failed to play TTS"));
};

     a.play().catch((err) => {
  console.log("[ConversationCoach] audio play rejected", err);
  try {
    URL.revokeObjectURL(prepared.url);
  } catch {}
  activeTtsRef.current = { url: "", resolve: null };
  setIsPendingAssistantPlayback(false);
  setIsTtsWaveformActive(false);
  setIsPreparingFeedbackAudio(false);
  setIsTranscriptOpen(false);
  reject(err);
});
   } catch (err) {
  try {
    URL.revokeObjectURL(prepared.url);
  } catch {}
  activeTtsRef.current = { url: "", resolve: null };
  setIsPendingAssistantPlayback(false);
  setIsTtsWaveformActive(false);
  setIsTranscriptOpen(false);
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
  console.log("[ConversationCoach] mounted");

  return () => {
    console.log("[ConversationCoach] unmounted");
    mountedRef.current = false;
    finalizeDailyTalkSession();
    clearTalkPaywallTimer();
    try {
      realtimeRef.current?.disconnect?.();
    } catch {}
  };
}, []);
useEffect(() => {
  const open = hasEnteredConversation;

  window.dispatchEvent(
    new CustomEvent("ac:conversationCoachFullscreen", {
      detail: { open },
    })
  );

  return () => {
    window.dispatchEvent(
      new CustomEvent("ac:conversationCoachFullscreen", {
        detail: { open: false },
      })
    );
  };
}, [hasEnteredConversation]);
useEffect(() => {
  setVisibleAssistantText(String(assistantText || "").trim());
}, [assistantText]);

useEffect(() => {
  if (!isPracticeActive) {
    setIsPracticeVisible(false);
    return;
  }

  const id = requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setIsPracticeVisible(true);
    });
  });

  return () => cancelAnimationFrame(id);
}, [isPracticeActive, currentPracticeIndex]);
useEffect(() => {
  window.dispatchEvent(
    new CustomEvent("ac:accentOverlay", { detail: { open: isAccentMenuOpen } })
  );

  if (!isAccentMenuOpen) return;

  setIsAccentSheetClosing(false);
  setAccentSheetTranslateY(window.innerHeight);

  const id = requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setAccentSheetTranslateY(ACCENT_SHEET_OPEN_Y);
    });
  });

  return () => cancelAnimationFrame(id);
}, [isAccentMenuOpen]);

useEffect(() => {
  function handleTabReselect(e) {
    console.log("[ConversationCoach] ac:tabReselect fired", e?.detail);
    if (e?.detail?.path !== "/conversation-coach") return;

    finalizeDailyTalkSession();
    clearTalkPaywallTimer();
    talkPaywallShownRef.current = false;
    talkSessionStartedAtRef.current = 0;
    talkSessionLimitMsRef.current = 0;

    try {
      realtimeRef.current?.disconnect?.();
    } catch {}

    stopFeedbackTts();
console.log("[ConversationCoach] RESET via ac:tabReselect");
    setHasEnteredConversation(false);
    setHasConversationStarted(false);

  setAssistantText("");
setVisibleAssistantText("");
setIsTranscriptOpen(false);
setMessages([]);
setFeedbackSummary("");
setSpokenFeedbackText("");
setFeedbackMetrics([]);
setPendingNextAssistantText("");
setHasIntroGreetingFinished(false);
introGreetingPlayingRef.current = false;
    setIsRecording(false);
    setIsAnalyzing(false);
    setIsPreparingFeedbackAudio(false);
    setIsWorkingOnFeedback(false);
setIsAiSpeaking(false);
setIsPendingAssistantPlayback(false);
setIsWaitingToContinue(false);
    setIsStartingConversation(false);
    setHoldScale(1);

    setIsPracticeActive(false);
    setIsPracticeVisible(false);
    setPracticeWords([]);
    setCurrentPracticeIndex(0);
    setIsPracticeRecording(false);
    setIsPracticeAnalyzing(false);
    setPracticeFeedbackText("");
    setPracticeLastScore(null);
    setPracticeRecordingResult(null);

    setError("");
    lastUserTranscriptRef.current = "";
    userSpeechStartedRef.current = false;
    suppressNextAssistantResponseRef.current = false;
    waitingForUserReleaseRef.current = false;
    holdStartedRef.current = false;
    practiceHoldStartedRef.current = false;
  }

  window.addEventListener("ac:tabReselect", handleTabReselect);
  return () => window.removeEventListener("ac:tabReselect", handleTabReselect);
}, []);  
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
  language: selectedAccent,
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
if (userTranscript) {
  setMessages((prev) => [
    ...prev,
    { role: "user", text: userTranscript }
  ]);
}
    if (!userTranscript) {
setFeedbackSummary("I couldn’t transcribe what you said. Please try again.");
setSpokenFeedbackText("");
setFeedbackMetrics([]);
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
  language: selectedAccent,
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
console.log("[ConversationCoach] spokenFeedbackText final =", spokenText);
setSpokenFeedbackText(spokenText);
setFeedbackMetrics(buildConversationFeedbackMetrics(azureJson));
setPendingNextAssistantText(aiJson?.nextAssistantText || "");

const weakPracticeWords = pickWeakPracticeWords(
  Array.isArray(azureJson?.words) ? azureJson.words : []
);

const startedPractice = startPracticeFlowFromWords(weakPracticeWords);

if (spokenText) {
  setIsAnalyzing(false);
  setIsPreparingFeedbackAudio(true);
  setIsAiSpeaking(true);
  setIsWaitingToContinue(!startedPractice);
  setIsWaitingToContinue(!startedPractice);

  speakText(spokenText)
    .then(() => {
      if (!mountedRef.current) return;
      setIsAiSpeaking(false);
      setIsPreparingFeedbackAudio(false);
    })
    .catch((err) => {
      if (!mountedRef.current) return;
      setIsAiSpeaking(false);
      setIsPreparingFeedbackAudio(false);
      setError(err?.message || "TTS failed.");
    });
} else {
  setIsAnalyzing(false);
  setIsWorkingOnFeedback(false);
  setIsWaitingToContinue(!startedPractice);
}
} catch (err) {
  const msg =
    err?.name === "AbortError"
      ? "Speech analysis timed out."
      : err?.message || "Speech analysis failed.";

setError(msg);
setFeedbackSummary(msg);
setSpokenFeedbackText("");
setFeedbackMetrics([]);
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
  language: selectedAccent,
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
    finalizeDailyTalkSession();
    clearTalkPaywallTimer();
    talkPaywallShownRef.current = false;
    talkSessionStartedAtRef.current = 0;
    talkSessionLimitMsRef.current = 0;

      try {
        realtimeRef.current?.disconnect?.();
      } catch {}

     setError("");
setAssistantText("");
setVisibleAssistantText("");
setIsTranscriptOpen(false);
setMessages([]);
setFeedbackSummary("");
setFeedbackMetrics([]);
setHasConversationStarted(false);
setHasIntroGreetingFinished(false);
setHoldScale(1);
setIsAiSpeaking(false);
setIsPendingAssistantPlayback(false);
setIsRecording(false);
setIsWaitingToContinue(false);
setSpokenFeedbackText("");
setPendingNextAssistantText("");
setIsStartingConversation(true);
setShowConnectionFailedScreen(false);
lastUserTranscriptRef.current = "";
pendingBritishTtsRef.current = "";

console.log("[ConversationCoach] starting realtime with accent =", selectedAccent);
const rt = await createRealtimeConversation({
  accent: selectedAccent,
  onRemoteAudio: () => {
    return;
  },
        onMessage: (msg) => {
          console.log("[realtime msg]", msg);

          const type = msg?.type || "";
console.log("[ConversationCoach][MSG_TRACE]", {
  type,

  before: {
    hasConversationStarted,
    hasIntroGreetingFinished,
    introGreetingPlayingRef: introGreetingPlayingRef.current,
    assistantText,
    visibleAssistantText,
    isTranscriptOpen,
    isPendingAssistantPlayback,
    isAiSpeaking,
    isPreparingFeedbackAudio,
    isStartingConversation,
  },

  deltaText:
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
      : "",
});
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

flushSync(() => {
  setAssistantText("");
});
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
  type === "response.output_audio_transcript.delta" ||
  type === "response.output_text.done" ||
  type === "response.text.done" ||
  type === "response.output_audio_transcript.done" ||
  type === "response.content_part.added" ||
  type === "response.content_part.done"
) {
  if (!suppressNextAssistantResponseRef.current && deltaText) {
    flushSync(() => {
     // IGNORER delta updates helt
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
  flushSync(() => {
    setAssistantText(finalText);
    setVisibleAssistantText(finalText);
    setHasConversationStarted(true);
    setIsTranscriptOpen(true);
    setIsPendingAssistantPlayback(true);
  });
}
if (finalText) {
  setMessages((prev) => [
    ...prev,
    { role: "ai", text: finalText }
  ]);
}
if (finalText) {
  console.log("[ConversationCoach] response.done intro transcript only", {
    finalText,
    selectedAccent,
    introGreetingPlaying: introGreetingPlayingRef.current,
  });

  setIsAnalyzing(false);
  setIsTranscriptOpen(true);
  setIsAiSpeaking(true);
  setIsPendingAssistantPlayback(true);

  return;
}

setIsAnalyzing(false);
}
if (type === "output_audio_buffer.started") {
  console.log("[ConversationCoach] output audio started", {
    introGreetingPlaying: introGreetingPlayingRef.current,
  });

  setHasConversationStarted(true);
  setIsAiSpeaking(true);
  setIsPendingAssistantPlayback(true);
  setIsTranscriptOpen(true);

if (!visibleAssistantText && assistantText) {
  setVisibleAssistantText(assistantText);
}
}
if (
  type === "output_audio_buffer.stopped" ||
  type === "output_audio_buffer.cleared"
) {
  console.log("[ConversationCoach] output audio stopped", {
    introGreetingPlaying: introGreetingPlayingRef.current,
  });

  setIsAiSpeaking(false);
  setIsPendingAssistantPlayback(false);
  setIsPreparingFeedbackAudio(false);

  if (!feedbackBusyRef.current) {
    setIsAnalyzing(false);
  }

  if (introGreetingPlayingRef.current) {
    console.log("[ConversationCoach] MARKING INTRO FINISHED FROM REALTIME AUDIO STOP");

    setIsTranscriptOpen(false);
    setAssistantText("");
    setVisibleAssistantText("");
    setHasIntroGreetingFinished(true);
    introGreetingPlayingRef.current = false;
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

  if (!hasConversationStarted) {
    setShowConnectionFailedScreen(true);
    setIsStartingConversation(false);
  }
},
      });

         realtimeRef.current = rt;
      await rt.connect();
if (exitRequestedRef.current || !mountedRef.current) {
  try {
    rt.disconnect?.();
  } catch {}
  return;
}
// Trigger the assistant to speak first
const ok = rt.startAssistantGreeting?.();
if (!ok) {
  setError("Failed to trigger assistant greeting.");
  setShowConnectionFailedScreen(true);
  setIsStartingConversation(false);
} else {
  introGreetingPlayingRef.current = true;
  console.log("[ConversationCoach][INTRO_START]", {
    introGreetingPlayingRef: introGreetingPlayingRef.current,
  });
  startTalkPaywallTimer();
}
} catch (err) {
  console.error(err);
  setError(err?.message || "Failed to start realtime conversation.");
  if (!hasConversationStarted) {
    setShowConnectionFailedScreen(true);
  }
} finally {
      if (mountedRef.current) setIsStartingConversation(false);
    }
  }
function handleExitConnectingFlow() {
    exitRequestedRef.current = true;
  console.log("[ConversationCoach][EXIT_TAPPED]", {
  currentScreen,
  hasEnteredConversation,
  hasConversationStarted,
  hasIntroGreetingFinished,
  introGreetingPlayingRef: introGreetingPlayingRef.current,
  assistantText,
  visibleAssistantText,
  isTranscriptOpen,
  isPendingAssistantPlayback,
  isAiSpeaking,
  isPreparingFeedbackAudio,
});
  try {
    realtimeRef.current?.disconnect?.();
  } catch {}

  clearTalkPaywallTimer();
  talkPaywallShownRef.current = false;
  talkSessionStartedAtRef.current = 0;
  talkSessionLimitMsRef.current = 0;

  stopFeedbackTts();

setHasEnteredConversation(false);
setHasConversationStarted(false);
setAssistantText("");
setVisibleAssistantText("");
setIsTranscriptOpen(false);
setMessages([]);
setFeedbackSummary("");
setSpokenFeedbackText("");
setFeedbackMetrics([]);
setPendingNextAssistantText("");
setHasIntroGreetingFinished(false);
introGreetingPlayingRef.current = false;
  setIsRecording(false);
  setIsAnalyzing(false);
  setIsPreparingFeedbackAudio(false);
  setIsWorkingOnFeedback(false);
setIsAiSpeaking(false);
setIsPendingAssistantPlayback(false);
setIsWaitingToContinue(false);
  setIsStartingConversation(false);
  setShowConnectionFailedScreen(false);
  setError("");
  setHoldScale(1);

  lastUserTranscriptRef.current = "";
  userSpeechStartedRef.current = false;
  suppressNextAssistantResponseRef.current = false;
  waitingForUserReleaseRef.current = false;
  holdStartedRef.current = false;
  practiceHoldStartedRef.current = false;
}
async function handleRetryConnection() {
  setShowConnectionFailedScreen(false);
  setError("");
  await startNewConversation();
}
async function handleEnterConversation() {
  exitRequestedRef.current = false;
  setHasEnteredConversation(true);
  await startNewConversation();
}


function handleHoldStart(e) {
  e?.preventDefault?.();

  stopFeedbackTts();

  if (holdStartedRef.current) return;
  holdStartedRef.current = true;

  userSpeechStartedRef.current = false;
  suppressNextAssistantResponseRef.current = false;
  waitingForUserReleaseRef.current = true;
  lastUserTranscriptRef.current = "";
pendingBritishTtsRef.current = "";

  const ok = realtimeRef.current?.startUserInput?.();
  if (!ok) {
    setError("Microphone is not ready.");
    holdStartedRef.current = false;
    return;
  }
setIsAiSpeaking(false);
setIsPendingAssistantPlayback(false);
setIsRecording(true);
setIsAnalyzing(false);
setIsPreparingFeedbackAudio(false);
setIsWorkingOnFeedback(false);
  setIsWaitingToContinue(false);
  setHasConversationStarted(true);
  setError("");
setFeedbackSummary("");
setSpokenFeedbackText("");
setFeedbackMetrics([]);
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
  setIsPracticeVisible(false);
  setIsPracticeRecording(false);
  setIsPracticeAnalyzing(false);
  setPracticeFeedbackText("");
  setPracticeLastScore(null);
  setPracticeRecordingResult(null);
  return true;
}

function handleSkipPractice() {
  setIsPracticeVisible(false);

  setTimeout(() => {
    setIsPracticeActive(false);
    setPracticeWords([]);
    setCurrentPracticeIndex(0);
    setPracticeFeedbackText("");
    setPracticeLastScore(null);
    setPracticeRecordingResult(null);
  }, 220);
}

function handleContinueFromPracticeWord() {
  const isLast = currentPracticeIndex >= practiceWords.length - 1;

  if (!isLast) {
    setIsPracticeVisible(false);

  setTimeout(() => {
  setCurrentPracticeIndex((prev) => prev + 1);
  setPracticeFeedbackText("");
  setPracticeLastScore(null);
  setPracticeRecordingResult(null);
}, 220);

    return;
  }

  setIsPracticeVisible(false);

  setTimeout(() => {
    setIsPracticeActive(false);
    setPracticeWords([]);
    setCurrentPracticeIndex(0);
    setPracticeFeedbackText("");
    setPracticeLastScore(null);
    setPracticeRecordingResult(null);

    if (pendingNextAssistantText) {
      setAssistantText(pendingNextAssistantText);
      setPendingNextAssistantText("");
    }

    setIsWaitingToContinue(false);
  }, 220);
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

  stopFeedbackTts();

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
function closeAccentSheet() {
  setIsAccentSheetClosing(true);
  setAccentSheetTranslateY(window.innerHeight);

  window.setTimeout(() => {
    setIsAccentMenuOpen(false);
    setIsAccentSheetClosing(false);
    setAccentSheetTranslateY(window.innerHeight);
  }, ACCENT_SHEET_CLOSE_MS);
}

function openAccentSheet() {
  setIsAccentMenuOpen(true);
  setIsAccentSheetClosing(false);
  setAccentSheetTranslateY(window.innerHeight);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setAccentSheetTranslateY(ACCENT_SHEET_OPEN_Y);
    });
  });
}

function handleAccentSheetPointerDown(e) {
  e.preventDefault();
  e.stopPropagation();
  accentSheetDraggingRef.current = true;
  accentSheetDragStartYRef.current = e.clientY;
  accentSheetDragStartTranslateYRef.current = accentSheetTranslateY;
}

function handleAccentSheetPointerMove(e) {
  if (!accentSheetDraggingRef.current) return;

  const deltaY = e.clientY - accentSheetDragStartYRef.current;
  const nextY = clamp(
    accentSheetDragStartTranslateYRef.current + deltaY,
    ACCENT_SHEET_OPEN_Y,
    window.innerHeight
  );

  setAccentSheetTranslateY(nextY);
}

function handleAccentSheetPointerEnd() {
  if (!accentSheetDraggingRef.current) return;
  accentSheetDraggingRef.current = false;

  const shouldClose = accentSheetTranslateY > 180;

  if (shouldClose) {
    closeAccentSheet();
    return;
  }

  setAccentSheetTranslateY(ACCENT_SHEET_OPEN_Y);
}

function handleAccentSelect(nextAccent) {
  if (!nextAccent || nextAccent === selectedAccent) {
    closeAccentSheet();
    return;
  }

  const canChangeAccent =
    !isStartingConversation &&
    !isRecording &&
    !isAnalyzing &&
    !isPreparingFeedbackAudio &&
    !isWorkingOnFeedback &&
    !isAiSpeaking &&
    !isPracticeRecording &&
    !isPracticeAnalyzing;

  if (!canChangeAccent) {
    closeAccentSheet();
    return;
  }

setSelectedAccent(nextAccent);
setSettings((prev) => ({
  ...prev,
  accentDefault: nextAccent,
}));
closeAccentSheet();
}
function handleInterruptIntroPlayback() {
  try {
    realtimeRef.current?.interruptAssistant?.();
  } catch {}

  stopFeedbackTts();

  setIsTranscriptOpen(false);
  setIsPendingAssistantPlayback(false);
  setIsAiSpeaking(false);
  setIsPreparingFeedbackAudio(false);
  setIsWorkingOnFeedback(false);

  setAssistantText("");
  setVisibleAssistantText("");
  setHasConversationStarted(true);
  setHasIntroGreetingFinished(true);

  introGreetingPlayingRef.current = false;
}
async function handleContinueAfterFeedback() {
  try {
    stopFeedbackTts();
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
const selectedAccentOption = getAccentOption(selectedAccent);

const isAccentLocked =
    isStartingConversation ||
    isRecording ||
    isAnalyzing ||
    isPreparingFeedbackAudio ||
    isWorkingOnFeedback ||
    isAiSpeaking ||
    isPracticeRecording ||
    isPracticeAnalyzing;
    const showTranscriptButton =
  !showConnectionFailedScreen &&
  !isStartingConversation &&
  hasIntroGreetingFinished && // 👈 vigtig
  (isAiSpeaking || isPreparingFeedbackAudio || isTranscriptOpen);

const hasVisibleIntroTranscript = !!String(visibleAssistantText || assistantText || "").trim();
const shouldShowConversationFeedbackScreen =
  hasIntroGreetingFinished &&
  !isRecording &&
  !isPracticeActive &&
  feedbackMetrics.length > 0 &&
  (
    isPreparingFeedbackAudio ||
    isWorkingOnFeedback ||
    !!spokenFeedbackText ||
    isWaitingToContinue
  );
const shouldShowIntroTranscriptScreen =
  !hasIntroGreetingFinished &&
  (
    isPendingAssistantPlayback ||
    isAiSpeaking ||
    isPreparingFeedbackAudio ||
    isTranscriptOpen ||
    introGreetingPlayingRef.current
  ) &&
  hasVisibleIntroTranscript;

const shouldShowConnectingScreen =
  !showConnectionFailedScreen &&
  (
    isStartingConversation ||
    (
      !hasIntroGreetingFinished &&
      !hasVisibleIntroTranscript
    )
  );
  const currentScreen =
  showConnectionFailedScreen
    ? "connection-failed"
    : shouldShowIntroTranscriptScreen
    ? "intro-transcript"
    : shouldShowConnectingScreen
    ? "connecting"
    : "hold-to-speak";

useEffect(() => {
  console.log("[ConversationCoach][SCREEN_TRACE]", {
    currentScreen,
    hasEnteredConversation,
    hasConversationStarted,
    hasIntroGreetingFinished,
    introGreetingPlayingRef: introGreetingPlayingRef.current,
    assistantText,
    visibleAssistantText,
    hasVisibleIntroTranscript,
    isTranscriptOpen,
    isPendingAssistantPlayback,
    isAiSpeaking,
    isPreparingFeedbackAudio,
    isStartingConversation,
    showConnectionFailedScreen,
    shouldShowConnectingScreen,
    shouldShowIntroTranscriptScreen,
  });
}, [
  currentScreen,
  hasEnteredConversation,
  hasConversationStarted,
  hasIntroGreetingFinished,
  assistantText,
  visibleAssistantText,
  hasVisibleIntroTranscript,
  isTranscriptOpen,
  isPendingAssistantPlayback,
  isAiSpeaking,
  isPreparingFeedbackAudio,
  isStartingConversation,
  showConnectionFailedScreen,
  shouldShowConnectingScreen,
  shouldShowIntroTranscriptScreen,
]);
console.log("[ConversationCoach] RENDER FLAGS", {
  hasIntroGreetingFinished,
  introGreetingPlaying: introGreetingPlayingRef.current,
  isPendingAssistantPlayback,
  isAiSpeaking,
  isPreparingFeedbackAudio,
  assistantText,
});
    console.log("[ConversationCoach] view gate", {
  hasEnteredConversation,
  hasConversationStarted,
});
  return (
  <div
    className="page"
    data-page-scroll="true"
    style={{
      minHeight: "100dvh",
      background: "#FFFFFF",
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
        {!hasEnteredConversation ? (
          <div
            style={{
              height: 72,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 20,
              paddingLeft: 12,
              paddingRight: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
  ref={accentMenuRef}
  style={{
    position: "relative",
  }}
>
  <button
    type="button"
    onClick={() => {
      if (isAccentLocked) return;
      setIsAccentMenuOpen((prev) => !prev);
    }}
    disabled={isAccentLocked}
    style={{
      border: "none",
      background: "transparent",
      padding: 0,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      cursor: isAccentLocked ? "not-allowed" : "pointer",
      opacity: isAccentLocked ? 0.7 : 1,
    }}
  >
    <span
      aria-hidden="true"
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 30,
        lineHeight: 1,
        background: "#FFFFFF",
      }}
    >
      {selectedAccentOption.flag}
    </span>

    <ChevronDown
      size={18}
      strokeWidth={2.8}
      style={{
        color: "#0F172A",
        transform: isAccentMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 180ms ease",
      }}
    />
  </button>
</div>

             
            </div>

            {isAccentMenuOpen ? (
              <div
                onClick={() => setIsAccentMenuOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 200,
                  background: "rgba(0,0,0,0.04)",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
           
  <div
  onClick={(e) => e.stopPropagation()}
  style={{
    width: "100%",
    background: "#F3F3F3",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: "22px 18px calc(18px + env(safe-area-inset-bottom))",
    boxShadow: "0 -10px 30px rgba(15,23,42,0.10)",
    minHeight: "88vh",
    maxHeight: "92vh",
    overflowY: "auto",
    transform: `translateY(${accentSheetTranslateY}px)`,
    transition: accentSheetDraggingRef.current
      ? "none"
      : isAccentSheetClosing
      ? ACCENT_SHEET_CLOSE_TRANSITION
      : ACCENT_SHEET_OPEN_TRANSITION,
    touchAction: "pan-y",
    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
  }}
>
                <div
  onPointerDown={handleAccentSheetPointerDown}
  onPointerMove={handleAccentSheetPointerMove}
  onPointerUp={handleAccentSheetPointerEnd}
  onPointerCancel={handleAccentSheetPointerEnd}
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingBottom: 10,
    marginBottom: 8,
    touchAction: "none",
    cursor: "grab",
    userSelect: "none",
    WebkitUserSelect: "none",
  }}
>
  <div
    style={{
      width: 48,
      height: 5,
      borderRadius: 999,
      background: "rgba(15,23,42,0.14)",
      margin: "0 auto 18px",
    }}
  />

  <div
    style={{
      fontSize: 28,
      fontWeight: 900,
      color: "#0F172A",
      textAlign: "center",
      marginBottom: 0,
      letterSpacing: -0.5,
    }}
  >
    Accent
  </div>
</div>

                  
                 <div
  style={{
    display: "grid",
    gap: 18,
  }}
>
  {ACCENT_SECTIONS.map((section) => (
    <div
      key={section.title}
      style={{
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          paddingLeft: 6,
         fontSize: 18,
fontWeight: 900,
          color: "#0F172A",
          letterSpacing: 0.2,
          textTransform: "none",
        }}
      >
        {section.title}
      </div>

      <div
        style={{
          display: "grid",
          gap: 14,
        }}
      >
        {section.options.map((option) => {
          const isSelected = option.value === selectedAccent;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleAccentSelect(option.value)}
              style={{
                width: "100%",
                minHeight: 92,
                padding: "0 22px",
                borderRadius: 24,
                border: "none",
                background: isSelected ? "#171717" : "#E9E9E9",
                color: isSelected ? "#FFFFFF" : "#0F172A",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  minWidth: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 31,
                    background: isSelected ? "#171717" : "#E9E9E9",
                  }}
                >
                  {option.flag}
                </span>

                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    lineHeight: 1.2,
                  }}
                >
                  {option.label}
                </span>
              </span>

              {isSelected ? <Check size={22} strokeWidth={3} /> : <span style={{ width: 22 }} />}
            </button>
          );
        })}
      </div>
    </div>
  ))}
</div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

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
                textAlign: "center",
                padding: "0 8px",
              }}
            >
              <img
                src={fluentUpLogo}
                alt="FluentUp"
                style={{
                  width: 150,
                  height: 150,
                  objectFit: "contain",
                  display: "block",
                  margin: "0 auto 18px",
                }}
              />

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  maxWidth: 320,
                  margin: "0 auto",
                  marginTop: 6,
                }}
              >
                <button
                  type="button"
                  onClick={async () => {
                    await triggerButtonHaptic();
                    handleEnterConversation();
                  }}
                  disabled={isStartingConversation}
                  style={{
                    width: "100%",
                    height: 62,
                    borderRadius: 999,
                    border: "none",
                    background: "#2F54EB",
                    color: "#F5EEDC",
                    fontSize: 21,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: isStartingConversation ? "not-allowed" : "pointer",
                    boxShadow: "none",
                    letterSpacing: "-0.02em",
                    opacity: isStartingConversation ? 0.78 : 1,
                  }}
                >
                  {isStartingConversation ? "Starting..." : "Start Conversation"}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await triggerButtonHaptic();
                    nav("/ai-chat");
                  }}
                  style={{
                    width: "100%",
                    height: 62,
                    borderRadius: 999,
                    border: "none",
                    background: "#EAEAEA",
                    color: "#111111",
                    fontSize: 21,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "none",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Scenarios
                </button>
              </div>
            </div>
          </div>
          ) : hasEnteredConversation ? (
         <div
  style={{
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    background: "#F3F3F3",
    padding: "24px 16px max(20px, env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    overflowX: "hidden",
  }}
>
          <div
  style={{
  position: "relative",
  zIndex: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingTop: 30,
  paddingLeft: 4,
  paddingRight: 4,
  pointerEvents: "auto",
}}
>
  <button
    type="button"
    onClick={handleExitConnectingFlow}
    style={{
  position: "relative",
  zIndex: 21,
  border: "none",
  background: "transparent",
  padding: 8,
  width: 44,
  height: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#111111",
  pointerEvents: "auto",
}}
  >
    <X size={36} strokeWidth={2.6} />
  </button>

{showTranscriptButton ? (
  <button
    type="button"
    onClick={() => setIsTranscriptOpen((prev) => !prev)}
    style={{
      border: "none",
      background: "transparent",
      padding: 8,
      width: 44,
      height: 44,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: "#111111",
    }}
  >
    <ReceiptText size={34} strokeWidth={2.2} />
  </button>
) : (
  <div style={{ width: 44, height: 44 }} />
)}
</div>

            {showConnectionFailedScreen ? (
              <button
                type="button"
                onClick={handleRetryConnection}
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transform: "translateY(-40px)",
                }}
              >
               <div
  aria-hidden="true"
  style={{
    width: 132,
    height: 132,
    borderRadius: "50%",
    border: "10px solid #111111",
    background: "transparent",
    boxSizing: "border-box",
  }}
/>

               <div
  style={{
    marginTop: 54,
    fontSize: 18,
    lineHeight: 1.15,
    fontWeight: 700,
    letterSpacing: -0.2,
    color: "#111111",
    textAlign: "center",
  }}
>
  Connection failed, tap to retry
</div>
              </button>
            ) : shouldShowConnectingScreen ? (
              <div
               style={{
  position: "relative",
  zIndex: 1,
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  transform: "translateY(-56px)",
}}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 126,
                    height: 126,
                    borderRadius: "50%",
                    background: "rgba(109, 142, 255, 0.45)",
                    animation: "conversationCoachConnectPulse 1.6s ease-in-out infinite",
                  }}
                />

                <div
                  style={{
                    marginTop: 56,
                    fontSize: 20,
                    lineHeight: 1.15,
                    fontWeight: 700,
                    letterSpacing: -0.2,
                    color: "#111111",
                  }}
                >
                  Connecting
                </div>
              </div>
            ) : shouldShowIntroTranscriptScreen ? (
  <div
    style={{
  position: "relative",
  zIndex: 1,
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  transform: "translateY(-70px)",
}}
  >
    <button
      type="button"
      onClick={handleInterruptIntroPlayback}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: "pointer",
      }}
    >
      <img
        src={fluentUpLogo}
        alt="FluentUp"
        style={{
          width: 126,
          height: 126,
          objectFit: "contain",
          display: "block",
          marginBottom: 24,
        }}
      />

      {isTranscriptOpen ? (
        <div
          style={{
            width: "100%",
            maxWidth: 700,
            marginTop: 10,
            paddingLeft: 18,
            paddingRight: 18,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "#F7F7F7",
              borderRadius: 28,
              padding: "28px 22px",
              boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                fontSize: 26,
                lineHeight: 1.16,
                fontWeight: 700,
                letterSpacing: -0.6,
                color: "#111111",
                textAlign: "left",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {visibleAssistantText || assistantText || "\u00A0"}
            </div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          marginTop: isTranscriptOpen ? 14 : 34,
          fontSize: 16,
          lineHeight: 1.2,
          fontWeight: 500,
          color: "rgba(17,17,17,0.42)",
        }}
      >
        Tap to interrupt
      </div>
    </button>
  </div>
  ) : isAnalyzing ? (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 24px",
      textAlign: "center",
      transform: "translateY(-24px)",
    }}
  >
    <div
      aria-hidden="true"
      style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        border: "5px solid rgba(17,17,17,0.12)",
        borderTopColor: "#111111",
        animation: "conversationCoachSpin 0.9s linear infinite",
        marginBottom: 22,
      }}
    />

    <div
      style={{
        fontSize: 22,
        lineHeight: 1.2,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color: "#111111",
        marginBottom: 8,
      }}
    >
      Analyzing...
    </div>

    <div
      style={{
        maxWidth: 320,
        fontSize: 15,
        lineHeight: 1.45,
        fontWeight: 500,
        color: "rgba(17,17,17,0.58)",
      }}
    >
      {feedbackSummary || "Analyzing your pronunciation..."}
    </div>
  </div>
) : shouldShowConversationFeedbackScreen ? (
  <>
   <div
  style={{
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    paddingTop: 4,
    paddingBottom: 18,
  }}
>
     <div
  style={{
    maxWidth: 560,
    margin: "0 auto",
    width: "100%",
  }}
>
        <div
  style={{
    textAlign: "center",
    marginTop: 2,
    marginBottom: 18,
  }}
>
         <div
  style={{
    fontSize: 42,
    lineHeight: 1,
    marginBottom: 6,
  }}
>
  👏
</div>

      <div
  style={{
    fontSize: 38,
    lineHeight: 0.98,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: "#111111",
  }}
>
  Nice job!
</div>
        </div>

       <div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    alignItems: "start",
    width: "100%",
  }}
>
          {feedbackMetrics.map((metric) => (
            <div key={metric.key}>
            <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
    minWidth: 0,
  }}
>
              <div
  style={{
    fontSize: 18,
    lineHeight: 1.1,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "#111111",
    minWidth: 0,
  }}
>
                  {metric.label}
                </div>

              <ChevronRight
  size={18}
  strokeWidth={2.6}
  style={{ color: "#111111", flexShrink: 0 }}
/>
              </div>

             <div
  style={{
    fontSize: 48,
    lineHeight: 0.95,
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color: "#111111",
    marginBottom: 12,
  }}
>
                {metric.value}
              </div>
<div
  style={{
    width: "100%",
    height: 12,
    borderRadius: 999,
    background: "#D9D9D9",
    overflow: "hidden",
  }}
>
                <div
                  style={{
                    width: `${metric.value}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: getMetricBarColor(metric.key),
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {spokenFeedbackText ? (
       <div
  style={{
    marginTop: 22,
    background: "#FFFFFF",
    borderRadius: 22,
    padding: "16px 16px",
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  }}
>
           <div
  style={{
    fontSize: 16,
    lineHeight: 1.45,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: "#111111",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  }}
>
              {spokenFeedbackText}
            </div>
          </div>
        ) : null}
      </div>
    </div>

    {isWaitingToContinue ? (
      <div
        style={{
          paddingBottom: "max(6px, env(safe-area-inset-bottom))",
        }}
      >
        <button
          type="button"
          onClick={handleContinueAfterFeedback}
          style={{
            width: "100%",
            height: 58,
            borderRadius: 999,
            border: "none",
            background: "#2B4EFF",
            color: "#FFFFFF",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            cursor: "pointer",
          }}
        >
          Continue
        </button>
      </div>
    ) : null}
  </>
) : (
  <>
    <div
      style={{
        flex: 1,
        position: "relative",
      }}
    >
      <button
        type="button"
        disabled={isRecording}
        onClick={() => {
          if (isRecording) return;
          setIsTranscriptOpen((prev) => !prev);
        }}
        style={{
          position: "absolute",
          top: -43,
          right: 4,
          border: "none",
          background: "transparent",
          padding: 8,
          width: 44,
          height: 44,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#111111",
          opacity: isRecording ? 0.45 : 1,
          pointerEvents: isRecording ? "none" : "auto",
        }}
      >
        <ReceiptText size={34} strokeWidth={2.2} />
      </button>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "52%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            marginBottom: 18,
            fontSize: 16,
            fontWeight: 500,
            color: "#111111",
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          {isRecording ? "Listening..." : "Hold to Speak"}
        </div>

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
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: "none",
            background: "linear-gradient(180deg, #2B4EFF 0%, #2242F3 100%)",
            color: "#FFFFFF",
            cursor: isBusy || isPracticeActive ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${holdScale})`,
            transition: "transform 120ms ease, box-shadow 120ms ease",
            boxShadow: "none",
            opacity: isBusy || isPracticeActive ? 0.76 : 1,
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          <Mic size={50} strokeWidth={2.5} />
        </button>

        {!!error && (
          <div
            style={{
              marginTop: 18,
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
  </>
)}
          </div>
        ) : null}
      </div>
            {isTranscriptOpen && hasIntroGreetingFinished && !shouldShowConversationFeedbackScreen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            background: "#F3F3F3",
            display: "flex",
            flexDirection: "column",
            padding: "24px 18px max(24px, env(safe-area-inset-bottom))",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 30,
              paddingLeft: 4,
              paddingRight: 4,
              marginBottom: 18,
            }}
          >
            <div style={{ width: 44, height: 44 }} />

            <div
              style={{
                fontSize: 34,
                lineHeight: 1,
                fontWeight: 800,
                letterSpacing: -0.8,
                color: "#111111",
              }}
            >
              Transcript
            </div>

            <button
              type="button"
              onClick={() => setIsTranscriptOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                padding: 8,
                width: 44,
                height: 44,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#111111",
              }}
            >
              <X size={36} strokeWidth={2.6} />
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "0 6px 8px",
            }}
          >
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";

              return (
                <div
                  key={i}
                  style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                    background: isUser ? "#111111" : "#F7F7F7",
                    color: isUser ? "#FFFFFF" : "#111111",
                    borderRadius: 24,
                    padding: "16px 18px",
                    fontSize: 20,
                    lineHeight: 1.28,
                    fontWeight: 600,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.text}
                </div>
              );
            })}

            {isAiSpeaking ? (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "#F7F7F7",
                  borderRadius: 24,
                  padding: "16px 18px",
                  minWidth: 84,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <span className="cc-dot" />
                  <span className="cc-dot" />
                  <span className="cc-dot" />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <audio ref={ttsAudioRef} />
<style>{`
  @keyframes conversationCoachSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes conversationCoachWave {
    0%   { transform: scaleY(0.45); opacity: 0.55; }
    25%  { transform: scaleY(1.45); opacity: 1; }
    50%  { transform: scaleY(0.75); opacity: 0.8; }
    75%  { transform: scaleY(1.2); opacity: 0.95; }
    100% { transform: scaleY(0.45); opacity: 0.55; }
  }

  @keyframes conversationCoachConnectPulse {
    0%   { transform: scale(0.88); opacity: 0.72; }
    50%  { transform: scale(1.08); opacity: 1; }
    100% { transform: scale(0.88); opacity: 0.72; }
  }

  .cc-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #111111;
    opacity: 0.28;
    animation: ccDotPulse 1.1s ease-in-out infinite;
  }

  .cc-dot:nth-child(2) {
    animation-delay: 0.18s;
  }

  .cc-dot:nth-child(3) {
    animation-delay: 0.36s;
  }

  @keyframes ccDotPulse {
    0% { opacity: 0.28; transform: scale(0.85); }
    50% { opacity: 1; transform: scale(1); }
    100% { opacity: 0.28; transform: scale(0.85); }
  }
`}</style>
    </div>
  );
}