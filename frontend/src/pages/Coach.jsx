import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Mic, StopCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "../lib/settings-store.jsx";
import { ingestLocalPhonemeScores } from "../lib/localPhonemeStats.js";
import wordsImg from "../assets/words.png";
import difficultyImg from "../assets/difficulty.png";
import accentImg from "../assets/accent.png";
import { useNavigate } from "react-router-dom";
import { useProStatus } from "../providers/PurchasesProvider.jsx";

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

const WORDS = {
  easy: ["water", "coffee", "music", "people", "world", "future", "camera", "really", "better", "today", "little", "maybe"],
  medium: ["comfortable", "sentence", "accent", "problem", "thirty", "through", "thought", "focus", "balance", "practice"],
  hard: ["particularly", "entrepreneurship", "authenticity", "responsibility", "vulnerability", "pronunciation", "indistinguishable"],
};

const SENTENCES = {
  easy: ["I like coffee.", "The water is cold.", "I live in Denmark.", "This is my phone.", "I want to speak clearly."],
  medium: [
    "I want to sound more natural when I speak.",
    "Please try to pronounce this clearly and slowly.",
    "I recorded my voice and got feedback.",
    "I will practice a little every day.",
  ],
  hard: [
    "I would rather practice consistently than rush and burn out.",
    "Clear pronunciation comes from rhythm, stress, and good vowels.",
    "I want my speech to be clear even when I speak quickly.",
  ],
};

const GAME_PASS_THRESHOLD = 90;
const SCORE_PER_SECOND = 18;
const FALL_SPEED_PX_PER_SEC = 132;
const OBSTACLE_START_Y = 128;
const ROCKET_CENTER_Y = 520;
const COLLISION_BUFFER = 74;
const FIRE_FLASH_MS = 720;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getOverallFromResult(json) {
  const raw =
    json?.overall ??
    json?.overallAccuracy ??
    json?.pronunciation ??
    json?.overall_score ??
    json?.overall_accuracy ??
    json?.pronunciation_score ??
    json?.pronunciation_accuracy ??
    json?.accuracyScore ??
    json?.accuracy_score;

  let n = Number(raw);
  if (!Number.isFinite(n)) n = 0;
  if (n > 0 && n <= 1) n *= 100;
  return clamp(Math.round(n), 0, 100);
}

function buildTargets({ mode, difficulty, total = 999 }) {
  const pool = mode === "sentences" ? (SENTENCES[difficulty] || []) : (WORDS[difficulty] || []);
  const uniq = Array.from(new Set(pool)).filter(Boolean);
  if (!uniq.length) return [];

  const out = [];
  while (out.length < total) {
    const shuffled = uniq.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    out.push(...shuffled);
  }
  return out.slice(0, total);
}

function feedbackForLowScore(target, overall, json) {
  const words = Array.isArray(json?.words) ? json.words : [];
  const weakestWord = words
    .map((w) => ({
      word: String(w?.word || "").trim(),
      score: Number(w?.accuracyScore ?? w?.overallAccuracy ?? w?.accuracy ?? 0),
      phonemes: Array.isArray(w?.phonemes) ? w.phonemes : [],
    }))
    .filter((w) => w.word)
    .sort((a, b) => a.score - b.score)[0];

  if (weakestWord?.phonemes?.length) {
    const weakestPhoneme = weakestWord.phonemes
      .map((p) => ({
        phoneme: String(p?.phoneme || p?.ipa || p?.symbol || "").trim(),
        score: Number(p?.accuracyScore ?? p?.accuracy ?? p?.score ?? 0),
      }))
      .filter((p) => p.phoneme)
      .sort((a, b) => a.score - b.score)[0];

    if (weakestPhoneme?.phoneme) {
      return `You were close, but the ${weakestPhoneme.phoneme} sound in “${weakestWord.word}” was still off. Score: ${overall}%.`;
    }
  }

  if (weakestWord?.word) {
    return `You were close, but “${weakestWord.word}” was not clear enough yet. Score: ${overall}%.`;
  }

  return `“${target}” was below the ${GAME_PASS_THRESHOLD}% target. You scored ${overall}%.`;
}

function rocketStyle() {
  return {
    position: "absolute",
    left: "50%",
    bottom: 78,
    transform: "translateX(-50%)",
    width: 74,
    height: 118,
    pointerEvents: "none",
    zIndex: 4,
  };
}

function Rocket({ boosting = false }) {
  return (
    <div style={rocketStyle()}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: "#D95F44",
            marginBottom: -2,
            zIndex: 2,
          }}
        />
        <div
          style={{
            width: 44,
            height: 56,
            borderRadius: "24px 24px 16px 16px",
            background: "linear-gradient(180deg, #FFF9ED 0%, #F6E5CD 100%)",
            border: "2px solid rgba(0,0,0,0.12)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "radial-gradient(circle at 35% 35%, #AEE8FF 0%, #4C9FCC 55%, #24506E 100%)",
              border: "2px solid rgba(0,0,0,0.18)",
              position: "absolute",
              left: "50%",
              top: 16,
              transform: "translateX(-50%)",
            }}
          />
        </div>
        <div
          style={{
            width: 14,
            height: 18,
            background: "#4A4A4A",
            borderRadius: "0 0 8px 8px",
            marginTop: -2,
            zIndex: 1,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 4,
            top: 50,
            width: 12,
            height: 28,
            background: "#D95F44",
            borderRadius: "10px 0 10px 10px",
            transform: "rotate(12deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 4,
            top: 50,
            width: 12,
            height: 28,
            background: "#D95F44",
            borderRadius: "0 10px 10px 10px",
            transform: "rotate(-12deg)",
          }}
        />
        <div
          style={{
            marginTop: -2,
            width: 22,
            height: boosting ? 34 : 24,
            borderRadius: "50% 50% 80% 80%",
            background: boosting
              ? "linear-gradient(180deg, #FFF2A6 0%, #FFB23F 45%, #FF6B1A 100%)"
              : "linear-gradient(180deg, #FFD87A 0%, #FF9A2E 50%, #F06519 100%)",
            filter: boosting ? "drop-shadow(0 10px 18px rgba(255,120,24,0.42))" : "drop-shadow(0 8px 14px rgba(255,120,24,0.34))",
          }}
        />
      </div>
    </div>
  );
}

export default function Coach() {
  const { settings } = useSettings();
  const nav = useNavigate();
  const { isPro } = useProStatus();

  function openPaywall(src) {
    nav(`/pro?src=${encodeURIComponent(src)}&return=/coach`);
  }

  const LIGHT_TEXT = "rgba(17,24,39,0.92)";
  const LIGHT_MUTED = "rgba(17,24,39,0.55)";
  const SAFE_BOTTOM = "env(safe-area-inset-bottom, 0px)";
  const TABBAR_OFFSET = 64;

  const [mode, setMode] = useState("words");
  const [difficulty, setDifficulty] = useState("easy");
  const [accentUi, setAccentUi] = useState(settings?.accentDefault || "en_us");
  const [setupStep, setSetupStep] = useState(0);
  const [phase, setPhase] = useState("setup");

  const [targets, setTargets] = useState([]);
  const [targetIndex, setTargetIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState("");
  const [obstacleY, setObstacleY] = useState(OBSTACLE_START_Y);
  const [score, setScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showStreakFlash, setShowStreakFlash] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [deadWord, setDeadWord] = useState("");
  const [deathFeedback, setDeathFeedback] = useState("");
  const [deathScore, setDeathScore] = useState(0);
  const [animatedDeathScore, setAnimatedDeathScore] = useState(0);
  const [lastOverall, setLastOverall] = useState(null);
  const [lastHeardText, setLastHeardText] = useState("");

  const micStreamRef = useRef(null);
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const animationFrameRef = useRef(0);
  const lastFrameAtRef = useRef(0);
  const currentWordRef = useRef("");
  const obstacleYRef = useRef(OBSTACLE_START_Y);
  const isAliveRef = useRef(false);
  const isProcessingRef = useRef(false);
  const scoreRef = useRef(0);

  useEffect(() => {
    setAccentUi(settings?.accentDefault || "en_us");
  }, [settings?.accentDefault]);

  useEffect(() => {
    setDisplayScore(Math.floor(score));
  }, [score]);

  useEffect(() => {
    if (phase !== "gameover") return;

    setAnimatedDeathScore(0);
    const target = Math.max(0, Math.floor(deathScore));
    const startedAt = performance.now();
    const duration = 900;
    let raf = 0;

    const tick = (t) => {
      const p = Math.min(1, (t - startedAt) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimatedDeathScore(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, deathScore]);

  useEffect(() => {
    return () => {
      try {
        cancelAnimationFrame(animationFrameRef.current);
      } catch {}
      try {
        micStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  async function ensureMic() {
    if (!navigator?.mediaDevices?.getUserMedia) throw new Error("Microphone not supported on this device.");
    const stream = micStreamRef.current || (await navigator.mediaDevices.getUserMedia({ audio: true }));
    micStreamRef.current = stream;

    let options = {};
    if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) options.mimeType = "audio/webm;codecs=opus";
      else if (MediaRecorder.isTypeSupported("audio/webm")) options.mimeType = "audio/webm";
      else if (MediaRecorder.isTypeSupported("audio/mp4")) options.mimeType = "audio/mp4";
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
    rec.onstop = () => handleRecordingStopped(rec);
    mediaRecRef.current = rec;
  }

  function stopRecordingIfActive() {
    try {
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
        mediaRecRef.current.stop();
      }
    } catch {}
  }

  function stopGameLoop() {
    try {
      cancelAnimationFrame(animationFrameRef.current);
    } catch {}
    animationFrameRef.current = 0;
    lastFrameAtRef.current = 0;
  }

  function spawnNextWord() {
    const next = targets[targetIndex] || "";
    setCurrentWord(next);
    currentWordRef.current = next;
    setObstacleY(OBSTACLE_START_Y);
    obstacleYRef.current = OBSTACLE_START_Y;
    setLastOverall(null);
    setLastHeardText("");
  }

  function endRunWithCrash(word, feedback) {
    if (!isAliveRef.current) return;

    isAliveRef.current = false;
    stopGameLoop();
    stopRecordingIfActive();
    setIsRecording(false);
    setIsAnalyzing(false);
    setDeadWord(word || currentWordRef.current || "");
    setDeathFeedback(feedback || `You needed at least ${GAME_PASS_THRESHOLD}% to clear this word.`);
    setDeathScore(Math.floor(scoreRef.current));
    setPhase("gameover");
  }

  function startGameLoop() {
    stopGameLoop();
    isAliveRef.current = true;
    lastFrameAtRef.current = performance.now();

    const tick = (now) => {
      if (!isAliveRef.current) return;

      const dt = Math.min(0.05, (now - lastFrameAtRef.current) / 1000);
      lastFrameAtRef.current = now;

      const nextScore = scoreRef.current + SCORE_PER_SECOND * dt;
      scoreRef.current = nextScore;
      setScore(nextScore);

      const nextY = obstacleYRef.current + FALL_SPEED_PX_PER_SEC * dt;
      obstacleYRef.current = nextY;
      setObstacleY(nextY);

      if (nextY >= ROCKET_CENTER_Y - COLLISION_BUFFER) {
        endRunWithCrash(currentWordRef.current, `You needed at least ${GAME_PASS_THRESHOLD}% to clear “${currentWordRef.current}”.`);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  }

  async function onStartGame() {
    if (!isPro) {
      openPaywall("coach_game_locked");
      return;
    }

    const built = buildTargets({ mode, difficulty, total: 999 });
    if (!built.length) return;

    await ensureMic();

    const accent = accentUi === "en_br" ? "en_br" : "en_us";
    setTargets(built);
    setTargetIndex(0);
    setCurrentWord(built[0]);
    currentWordRef.current = built[0];
    setObstacleY(OBSTACLE_START_Y);
    obstacleYRef.current = OBSTACLE_START_Y;
    setScore(0);
    scoreRef.current = 0;
    setDisplayScore(0);
    setStreak(0);
    setShowStreakFlash(false);
    setDeadWord("");
    setDeathFeedback("");
    setDeathScore(0);
    setAnimatedDeathScore(0);
    setLastOverall(null);
    setLastHeardText("");
    setPhase("playing");
    startGameLoop();
  }

  async function startRecording() {
    if (!mediaRecRef.current || isProcessingRef.current || !isAliveRef.current) return;
    chunksRef.current = [];
    mediaRecRef.current.start();
    setIsRecording(true);
  }

  function stopRecording() {
    stopRecordingIfActive();
  }

  async function toggleRecord() {
    if (phase !== "playing") return;
    if (isAnalyzing) return;
    if (isRecording) stopRecording();
    else await startRecording();
  }

  function handleRecordingStopped(rec) {
    setIsRecording(false);

    if (!isAliveRef.current) return;

    const chunks = chunksRef.current.slice();
    chunksRef.current = [];
    const type = chunks[0]?.type || rec?.mimeType || "audio/webm";
    const blob = new Blob(chunks, { type });

    if (!blob.size) return;
    sendToServer(blob);
  }

  async function sendToServer(audioBlob) {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsAnalyzing(true);

    try {
      const base = getApiBase();
      const target = currentWordRef.current;
      const accent = accentUi === "en_br" ? "en_br" : "en_us";

      const fd = new FormData();
      fd.append("audio", audioBlob, "clip.webm");
      fd.append("refText", target);
      fd.append("accent", accent);
      fd.append("slack", String(settings?.slack ?? 0));

      const controller = new AbortController();
      const timeoutMs = 15000;
      const t = setTimeout(() => controller.abort(), timeoutMs);

      let r;
      try {
        r = await fetch(`${base}/api/analyze-speech`, {
          method: "POST",
          body: fd,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(t);
      }

      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json?.error || r.statusText || "Analyze failed");

      const overall = getOverallFromResult(json);
      setLastOverall(overall);
      setLastHeardText(String(json?.transcript || "").trim());

      try {
        const accentKey = accent;
        const phonemePairs = [];
        const wordsArr = Array.isArray(json?.words) ? json.words : [];
        for (const w of wordsArr) {
          const ps = Array.isArray(w?.phonemes) ? w.phonemes : [];
          for (const p of ps) {
            const code = String(p?.phoneme || p?.ipa || p?.symbol || "").trim().toUpperCase();
            if (!code) continue;
            const raw =
              p?.accuracyScore ??
              p?.overallAccuracy ??
              p?.accuracy ??
              p?.pronunciation ??
              p?.score ??
              p?.overall ??
              p?.pronunciationAccuracy;
            const n = Number(raw);
            if (!Number.isFinite(n)) continue;
            const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
            phonemePairs.push({ phoneme: code, score: pct });
          }
        }
        if (phonemePairs.length) ingestLocalPhonemeScores(accentKey, phonemePairs);
      } catch {}

      if (!isAliveRef.current) return;

      if (overall >= GAME_PASS_THRESHOLD) {
        const nextIndex = targetIndex + 1;
        setStreak((prev) => prev + 1);
        setShowStreakFlash(true);
        window.setTimeout(() => setShowStreakFlash(false), FIRE_FLASH_MS);

        const bonus = 120;
        scoreRef.current += bonus;
        setScore(scoreRef.current);

        setTargetIndex(nextIndex);
        const nextWord = targets[nextIndex] || targets[nextIndex % targets.length] || target;
        setCurrentWord(nextWord);
        currentWordRef.current = nextWord;
        setObstacleY(OBSTACLE_START_Y);
        obstacleYRef.current = OBSTACLE_START_Y;
      }
    } catch (e) {
      // keep playing, do not kill the run here
    } finally {
      isProcessingRef.current = false;
      setIsAnalyzing(false);
    }
  }

  function onExit() {
    isAliveRef.current = false;
    stopGameLoop();
    stopRecordingIfActive();
    setIsRecording(false);
    setIsAnalyzing(false);
    setTargets([]);
    setTargetIndex(0);
    setCurrentWord("");
    setObstacleY(OBSTACLE_START_Y);
    setScore(0);
    scoreRef.current = 0;
    setDisplayScore(0);
    setStreak(0);
    setShowStreakFlash(false);
    setDeadWord("");
    setDeathFeedback("");
    setDeathScore(0);
    setAnimatedDeathScore(0);
    setLastOverall(null);
    setLastHeardText("");
    setSetupStep(0);
    setPhase("setup");
  }

  const question =
    setupStep === 0
      ? "What do you want to practice?"
      : setupStep === 1
      ? "Choose a difficulty level"
      : "Which accent do you want?";

  const options =
    setupStep === 0
      ? [
          { key: "words", label: "Words" },
          { key: "sentences", label: "Sentences" },
        ]
      : setupStep === 1
      ? [
          { key: "easy", label: "Easy" },
          { key: "medium", label: "Medium" },
          { key: "hard", label: "Hard" },
        ]
      : [
          { key: "en_us", label: "American 🇺🇸" },
          { key: "en_br", label: "British 🇬🇧" },
        ];

  const value = setupStep === 0 ? mode : setupStep === 1 ? difficulty : accentUi;

  function setValue(next) {
    if (setupStep === 0) setMode(next);
    else if (setupStep === 1) setDifficulty(next);
    else setAccentUi(next);
  }

  function WheelPicker({ options, value, onChange }) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        {options.map((option) => {
          const active = option.key === value;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              style={{
                height: 54,
                borderRadius: 18,
                border: active ? "1px solid rgba(33,150,243,0.95)" : "1px solid rgba(17,24,39,0.08)",
                background: active ? "rgba(33,150,243,0.10)" : "rgba(255,255,255,0.92)",
                fontSize: 19,
                fontWeight: 900,
                color: LIGHT_TEXT,
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="page"
      style={{
        position: "relative",
        minHeight: "100vh",
        background: phase === "setup" ? "linear-gradient(180deg, rgba(33,150,243,0.08) 0%, #FFFFFF 58%)" : "linear-gradient(180deg, #8EDBF8 0%, #CFEFFD 100%)",
        paddingBottom: 0,
        paddingTop: "var(--safe-top)",
        display: "flex",
        flexDirection: "column",
        color: LIGHT_TEXT,
        overflow: "hidden",
      }}
    >
      {phase === "setup" ? (
        <div
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 720,
            margin: "0 auto",
            padding: `12px 16px calc(${TABBAR_OFFSET}px + 16px + ${SAFE_BOTTOM})`,
            display: "grid",
            alignContent: "center",
            gap: 18,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => nav("/practice")}
              style={{ width: 44, height: 44, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}
            >
              <ChevronLeft className="h-8 w-8" style={{ color: LIGHT_TEXT }} />
            </button>
            <div style={{ textAlign: "center", fontSize: 34, fontWeight: 1000, letterSpacing: -0.8 }}>Speaking Game</div>
            <div />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: i === setupStep ? "rgba(33,150,243,0.95)" : "rgba(33,150,243,0.22)",
                }}
              />
            ))}
          </div>

          <div style={{ display: "grid", placeItems: "center" }}>
            <img
              src={setupStep === 0 ? wordsImg : setupStep === 1 ? difficultyImg : accentImg}
              alt=""
              style={{ width: 140, height: 140, objectFit: "contain", pointerEvents: "none", userSelect: "none" }}
            />
          </div>

          <div style={{ textAlign: "center", fontWeight: 500, fontSize: 22, letterSpacing: -0.45 }}>{question}</div>

          <WheelPicker options={options} value={value} onChange={setValue} />

          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            {setupStep > 0 ? (
              <button
                type="button"
                onClick={() => setSetupStep((s) => Math.max(0, s - 1))}
                style={{
                  height: 52,
                  padding: "0 18px",
                  borderRadius: 14,
                  border: "1px solid rgba(17,24,39,0.14)",
                  background: "rgba(255,255,255,0.45)",
                  color: "rgba(17,24,39,0.72)",
                  fontWeight: 850,
                  cursor: "pointer",
                  minWidth: 120,
                }}
              >
                Back
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                if (setupStep < 2) setSetupStep((s) => s + 1);
                else onStartGame();
              }}
              style={{
                height: 52,
                flex: 1,
                maxWidth: 420,
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(180deg, #2FA8FF 0%, #1E88E5 100%)",
                color: "white",
                fontWeight: 900,
                fontSize: 18,
                cursor: "pointer",
                boxShadow: "0 22px 60px rgba(33,150,243,0.28)",
              }}
            >
              {setupStep < 2 ? "Next" : "Start"}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "playing" ? (
        <div style={{ position: "relative", flex: 1, minHeight: "100vh", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 20% 18%, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 22%), radial-gradient(circle at 84% 36%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 16%), linear-gradient(180deg, #89D7F8 0%, #CFEFFD 100%)",
            }}
          />

          <div style={{ position: "absolute", top: 108, left: 54, width: 72, height: 26, borderRadius: 999, background: "rgba(255,255,255,0.58)", filter: "blur(2px)" }} />
          <div style={{ position: "absolute", top: 222, right: 46, width: 86, height: 28, borderRadius: 999, background: "rgba(255,255,255,0.44)", filter: "blur(2px)" }} />
          <div style={{ position: "absolute", top: 392, left: 32, width: 96, height: 30, borderRadius: 999, background: "rgba(255,255,255,0.40)", filter: "blur(2px)" }} />

          <button
            type="button"
            onClick={onExit}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 6,
              width: 42,
              height: 42,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.32)",
              background: "rgba(32,42,56,0.22)",
              color: "white",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            <X size={20} />
          </button>

          <div
            style={{
              position: "absolute",
              top: 24,
              left: 0,
              right: 0,
              zIndex: 5,
              display: "grid",
              justifyItems: "center",
            }}
          >
            <div style={{ fontSize: 58, lineHeight: 1, fontWeight: 1000, letterSpacing: -1.2, color: "white", textShadow: "0 8px 18px rgba(0,0,0,0.14)" }}>
              {displayScore}
            </div>
            <div style={{ marginTop: 2, fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.88)" }}>meters</div>
          </div>

          <AnimatePresence>
            {showStreakFlash ? (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.22 }}
                style={{
                  position: "absolute",
                  top: 210,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 5,
                  fontSize: 52,
                  fontWeight: 1000,
                  color: "rgba(255,255,255,0.95)",
                  textShadow: "0 8px 18px rgba(0,0,0,0.16)",
                }}
              >
                🔥 {streak}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {currentWord ? (
            <motion.div
              key={`${currentWord}-${targetIndex}`}
              initial={false}
              animate={{ top: obstacleY }}
              transition={{ type: "tween", duration: 0.08, ease: "linear" }}
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 3,
                minWidth: mode === "sentences" ? 250 : 170,
                maxWidth: "78vw",
                padding: mode === "sentences" ? "16px 18px" : "14px 18px",
                borderRadius: 20,
                background: "rgba(29,39,53,0.22)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.34)",
                boxShadow: "0 18px 38px rgba(0,0,0,0.12)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: mode === "sentences" ? 24 : 30, lineHeight: 1.1, fontWeight: 1000, letterSpacing: -0.6, color: "white" }}>
                {currentWord}
              </div>
            </motion.div>
          ) : null}

          <Rocket boosting={isRecording || isAnalyzing} />

          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 20,
              transform: "translateX(-50%)",
              zIndex: 6,
              minWidth: 170,
              height: 38,
              padding: "0 14px",
              borderRadius: 999,
              background: "rgba(31,41,55,0.78)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              color: "white",
              boxShadow: "0 16px 34px rgba(0,0,0,0.18)",
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#4ADE80", boxShadow: "0 0 0 4px rgba(74,222,128,0.18)" }} />
            <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.2 }}>
              {isAnalyzing ? "Analyzing..." : isRecording ? "Listening..." : 'Tap mic to say the word'}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleRecord}
            disabled={isAnalyzing}
            style={{
              position: "absolute",
              right: 18,
              bottom: 86,
              zIndex: 6,
              width: 66,
              height: 66,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.34)",
              background: isRecording ? "rgba(31,41,55,0.88)" : "rgba(255,255,255,0.94)",
              display: "grid",
              placeItems: "center",
              cursor: isAnalyzing ? "not-allowed" : "pointer",
              boxShadow: "0 18px 38px rgba(0,0,0,0.16)",
            }}
          >
            {isRecording ? <StopCircle size={28} color="white" /> : <Mic size={28} color="#111827" />}
          </button>

          {lastOverall !== null ? (
            <div
              style={{
                position: "absolute",
                left: 18,
                bottom: 94,
                zIndex: 6,
                borderRadius: 16,
                background: "rgba(255,255,255,0.90)",
                padding: "10px 12px",
                minWidth: 104,
                boxShadow: "0 14px 30px rgba(0,0,0,0.12)",
              }}
            >
              <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 1000, color: lastOverall >= GAME_PASS_THRESHOLD ? "#16A34A" : "#111827" }}>{lastOverall}%</div>
              {lastHeardText ? (
                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.2, fontWeight: 800, color: "rgba(17,24,39,0.58)", maxWidth: 110 }}>
                  Heard: {lastHeardText}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === "gameover" ? (
        <div
          style={{
            flex: 1,
            minHeight: "100vh",
            background: "#F7F3EE",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: `34px 24px calc(${TABBAR_OFFSET}px + 24px + ${SAFE_BOTTOM})`,
          }}
        >
          <div style={{ marginTop: 12, fontSize: 28, lineHeight: 1.15, fontWeight: 900, letterSpacing: -0.6, color: "rgba(17,24,39,0.72)" }}>
            You were killed by
          </div>

          <div style={{ marginTop: 54, fontSize: deadWord.length > 14 ? 40 : 54, lineHeight: 0.98, fontWeight: 1000, letterSpacing: -1.1, color: "#111827", wordBreak: "break-word" }}>
            {deadWord || "word"}
          </div>

          <div style={{ marginTop: 22, maxWidth: 360, fontSize: 18, lineHeight: 1.35, fontWeight: 700, color: "rgba(17,24,39,0.62)" }}>
            {deathFeedback}
          </div>

          <div style={{ marginTop: 52, fontSize: 76, lineHeight: 1, fontWeight: 1000, letterSpacing: -1.6, color: "rgba(17,24,39,0.58)", fontVariantNumeric: "tabular-nums" }}>
            {animatedDeathScore}
          </div>

          <div style={{ marginTop: 6, fontSize: 24, lineHeight: 1.15, fontWeight: 800, color: "rgba(17,24,39,0.62)" }}>
            meters above the ground
          </div>

          <div style={{ marginTop: "auto", width: "100%", maxWidth: 360, display: "grid", gap: 12 }}>
            <button
              type="button"
              onClick={async () => {
                setSetupStep(2);
                await onStartGame();
              }}
              style={{
                height: 58,
                borderRadius: 999,
                border: "none",
                background: "linear-gradient(180deg, #2FA8FF 0%, #1E88E5 100%)",
                color: "white",
                fontSize: 19,
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 22px 60px rgba(33,150,243,0.28)",
              }}
            >
              Play again
            </button>

            <button
              type="button"
              onClick={onExit}
              style={{
                height: 54,
                borderRadius: 999,
                border: "1px solid rgba(17,24,39,0.12)",
                background: "rgba(255,255,255,0.82)",
                color: LIGHT_TEXT,
                fontSize: 18,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
