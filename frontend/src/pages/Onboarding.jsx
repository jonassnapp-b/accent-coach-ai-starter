// src/pages/Onboarding.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Mic2, MessageSquareText, Target, Briefcase, Plane, Sparkles, Flag, AudioLines, Gauge, Circle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { saveOnboardingAnswers, setOnboardingDone } from "../lib/onboarding.js";

const BLUE = "#2196F3";
const ORANGE = "#FF9800";
const BG = "#0A0A0A";
const CARD = "#121212";
const CARD_2 = "#151515";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.62)";
const MUTED_2 = "rgba(255,255,255,0.45)";

const featureSlides = [
  {
    type: "hero",
    titleTop: "Speak Clearer",
    titleBottom: "Sound Confident",
    subtitle: "AI-powered pronunciation coach",
    bullets: [
      "Real-time pronunciation feedback",
      "Fix your accent step by step",
      "Train with AI conversations",
    ],
    cta: "Get Started",
  },
  {
    type: "feature",
    title: "AI Conversation Coach",
    subtitle: "Practice real conversations and get feedback while you speak.",
    dots: ["Real-time", "Personalized", "Interactive"],
    cta: "Next Feature",
    phoneTitle: "Coach",
    phoneBody: "Speak with AI and get live guidance while you practice.",
    icon: "conversation",
  },
  {
    type: "feature",
    title: "Pronunciation Feedback",
    subtitle: "Record your voice and get instant word-by-word and phoneme-level feedback.",
    dots: ["Precise", "Instant", "Actionable"],
    cta: "Next Feature",
    phoneTitle: "Practice",
    phoneBody: "See exactly what to fix and improve faster.",
    icon: "pronunciation",
  },
];

const questions = [
  {
    key: "goal",
    progressLabel: "1 of 4",
    eyebrow: "QUESTION 1",
    title: "Why do you want to improve your English?",
    subtitle: "Everyone wants to sound better for a different reason — what matters most to you?",
    cta: "Continue",
    options: [
      { value: "accent", label: "Improve my accent", emoji: "🇺🇸" },
      { value: "professional", label: "Sound more professional", emoji: "💼" },
      { value: "travel", label: "Speak more confidently when traveling", emoji: "✈️" },
      { value: "general", label: "General improvement", emoji: "🎯" },
    ],
  },
  {
    key: "accent",
    progressLabel: "2 of 4",
    eyebrow: "QUESTION 2",
    title: "Which accent do you want to train?",
    subtitle: "Pick the direction you want FluentUp to guide you toward.",
    cta: "Continue",
    options: [
      { value: "american", label: "American English", emoji: "🇺🇸" },
      { value: "british", label: "British English", emoji: "🇬🇧" },
      { value: "both", label: "A mix / not fully decided", emoji: "🌍" },
      { value: "notsure", label: "I’m not sure yet", emoji: "🤔" },
    ],
  },
  {
    key: "practiceStyle",
    progressLabel: "3 of 4",
    eyebrow: "QUESTION 3",
    title: "How do you want to practice most?",
    subtitle: "Choose the type of training you’ll actually enjoy sticking with.",
    cta: "Continue",
    options: [
      { value: "conversation", label: "AI conversations", emoji: "🗣️" },
      { value: "mytext", label: "Practice with my own text", emoji: "✍️" },
      { value: "drills", label: "Short focused pronunciation drills", emoji: "🎧" },
      { value: "mix", label: "A mix of everything", emoji: "✨" },
    ],
  },
  {
    key: "confidence",
    progressLabel: "4 of 4",
    eyebrow: "QUESTION 4",
    title: "How confident do you feel speaking English today?",
    subtitle: "No pressure — this just helps us start at the right level for you.",
    cta: "Build My Plan",
    options: [
      { value: "low", label: "I feel nervous speaking", emoji: "😅" },
      { value: "medium", label: "I’m okay, but I hesitate", emoji: "🙂" },
      { value: "good", label: "I speak fairly well already", emoji: "💬" },
      { value: "high", label: "I mainly want polish and clarity", emoji: "🔥" },
    ],
  },
];

function getProjectionCopy(answers) {
  const goal = answers.goal || "general";

  if (goal === "professional") {
    return {
      paragraph:
        "FluentUp will help you sound clearer, more polished, and more confident in professional situations. With targeted pronunciation training, AI conversation practice, and instant corrections, you’ll build habits that make your English sound more natural and trustworthy.",
      stat1: "Clearer speech",
      stat2: "More confident delivery",
    };
  }

  if (goal === "travel") {
    return {
      paragraph:
        "FluentUp will help you speak with more confidence in real-world situations like travel, small talk, and everyday conversations. By practicing speaking out loud and getting immediate feedback, you’ll build clarity faster than passive learning alone.",
      stat1: "More speaking confidence",
      stat2: "Better real-world practice",
    };
  }

  if (goal === "accent") {
    return {
      paragraph:
        "FluentUp will help you reduce unclear pronunciation patterns and build a more natural accent over time. With phoneme-level feedback, personalized practice, and AI conversations, you’ll know exactly what to improve instead of guessing.",
      stat1: "Faster accent improvement",
      stat2: "More precise feedback",
    };
  }

  return {
    paragraph:
      "FluentUp will create a personalized path to help you improve pronunciation, clarity, and speaking confidence. You’ll get guided practice, instant corrections, and AI-powered speaking sessions that make improvement feel structured and motivating.",
    stat1: "More consistent practice",
    stat2: "Faster spoken progress",
  };
}

function ProgressBar({ value }) {
  return (
    <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.12)", borderRadius: 999 }}>
      <div
        style={{
          width: `${value}%`,
          height: "100%",
          borderRadius: 999,
          background: BLUE,
          transition: "width 220ms ease",
        }}
      />
    </div>
  );
}

function BulletRow({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          background: "rgba(33,150,243,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: BLUE,
          flexShrink: 0,
        }}
      >
        <CheckCircle2 size={18} />
      </div>
      <div style={{ fontSize: 17, lineHeight: 1.35, color: "rgba(255,255,255,0.86)", fontWeight: 600 }}>
        {text}
      </div>
    </div>
  );
}

function PhoneMockup({ title, body, icon }) {
  return (
    <div
      style={{
        width: 240,
        maxWidth: "72vw",
        margin: "0 auto",
        borderRadius: 34,
        padding: 10,
        background: "#111",
        border: `1px solid ${BORDER}`,
        boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          borderRadius: 28,
          background: "#0E0E0E",
          padding: 16,
          minHeight: 330,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: 84,
            height: 6,
            borderRadius: 999,
            background: "rgba(255,255,255,0.16)",
            margin: "0 auto 18px",
          }}
        />
        <div
          style={{
            borderRadius: 20,
            padding: 18,
            background: "linear-gradient(180deg, rgba(33,150,243,0.95) 0%, rgba(33,150,243,0.82) 100%)",
            color: "#fff",
            marginBottom: 16,
          }}
        >
          <div style={{ opacity: 0.88, fontSize: 13, marginBottom: 10 }}>FluentUp</div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
          <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.4, opacity: 0.92 }}>{body}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ background: CARD_2, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14 }}>
            <div style={{ color: BLUE, marginBottom: 10 }}>
              {icon === "conversation" ? <MessageSquareText size={18} /> : <Mic2 size={18} />}
            </div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
              {icon === "conversation" ? "Live Coach" : "Instant Analysis"}
            </div>
          </div>
          <div style={{ background: CARD_2, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14 }}>
            <div style={{ color: ORANGE, marginBottom: 10 }}>
              {icon === "conversation" ? <AudioLines size={18} /> : <Gauge size={18} />}
            </div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
              {icon === "conversation" ? "Real-time" : "Phoneme Score"}
            </div>
          </div>
        </div>

        <div style={{ background: CARD_2, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14 }}>
          <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 13, marginBottom: 8 }}>Your Progress</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div style={{ background: "#101010", borderRadius: 12, padding: 10, textAlign: "center" }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>12</div>
              <div style={{ color: MUTED_2, fontSize: 11 }}>Sessions</div>
            </div>
            <div style={{ background: "#101010", borderRadius: 12, padding: 10, textAlign: "center" }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>84%</div>
              <div style={{ color: MUTED_2, fontSize: 11 }}>Clarity</div>
            </div>
            <div style={{ background: "#101010", borderRadius: 12, padding: 10, textAlign: "center" }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>7d</div>
              <div style={{ color: MUTED_2, fontSize: 11 }}>Streak</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureDots({ items }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap", marginTop: 18 }}>
      {items.map((item) => (
        <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Circle size={8} fill={BLUE} color={BLUE} />
          <span style={{ color: "rgba(255,255,255,0.72)", fontSize: 15, fontWeight: 700 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

function OptionButton({ selected, emoji, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 20,
        padding: "18px 18px",
        border: selected ? `1px solid ${BLUE}` : `1px solid ${BORDER}`,
        background: selected ? "rgba(33,150,243,0.12)" : "#0F0F0F",
        color: TEXT,
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: "pointer",
        boxShadow: selected ? "0 0 0 1px rgba(33,150,243,0.2) inset" : "none",
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>{emoji}</span>
      <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>{label}</span>
    </button>
  );
}

function LoadingStep({ done, active, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: done ? "#2ECC71" : active ? BLUE : "rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {done ? <CheckCircle2 size={18} /> : <Circle size={10} fill="#fff" color="#fff" />}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: active || done ? 700 : 600,
          color: active || done ? "#fff" : "rgba(255,255,255,0.38)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ProjectionChart() {
  const green = [18, 45, 60, 70, 76, 80];
  const red = [18, 18, 20, 23, 28, 35];
  const width = 320;
  const height = 180;
  const pad = 14;

  function pointsFrom(values) {
    return values
      .map((v, i) => {
        const x = pad + (i * (width - pad * 2)) / (values.length - 1);
        const y = height - pad - (v / 100) * (height - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div
      style={{
        background: "#0D0D0D",
        border: `1px solid ${BORDER}`,
        borderRadius: 24,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#53F07C", display: "inline-block" }} />
          <span style={{ color: "rgba(255,255,255,0.82)", fontWeight: 700 }}>With FluentUp</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#FF5F6D", display: "inline-block" }} />
          <span style={{ color: "rgba(255,255,255,0.82)", fontWeight: 700 }}>Traditional learning</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <polyline fill="none" stroke="#53F07C" strokeWidth="4" points={pointsFrom(green)} strokeLinecap="round" strokeLinejoin="round" />
        <polyline fill="none" stroke="#FF5F6D" strokeWidth="4" points={pointsFrom(red)} strokeLinecap="round" strokeLinejoin="round" />

        {green.map((v, i) => {
          const x = pad + (i * (width - pad * 2)) / (green.length - 1);
          const y = height - pad - (v / 100) * (height - pad * 2);
          return <circle key={`g-${i}`} cx={x} cy={y} r="5" fill="#53F07C" />;
        })}

        {red.map((v, i) => {
          const x = pad + (i * (width - pad * 2)) / (red.length - 1);
          const y = height - pad - (v / 100) * (height - pad * 2);
          return <circle key={`r-${i}`} cx={x} cy={y} r="5" fill="#FF5F6D" />;
        })}
      </svg>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", marginTop: 8 }}>
        {["W1", "W2", "W3", "W4", "W5", "W6"].map((x) => (
          <div key={x} style={{ textAlign: "center", color: MUTED_2, fontWeight: 700, fontSize: 12 }}>
            {x}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}>
        <div style={{ background: "#0F0F0F", borderRadius: 18, padding: 16, border: `1px solid ${BORDER}` }}>
          <div style={{ color: "#53F07C", fontWeight: 800, fontSize: 30, lineHeight: 1 }}>75%</div>
          <div style={{ color: "rgba(255,255,255,0.72)", fontWeight: 700, marginTop: 4 }}>Faster improvement</div>
        </div>
        <div style={{ background: "#0F0F0F", borderRadius: 18, padding: 16, border: `1px solid ${BORDER}` }}>
          <div style={{ color: "#FF5F6D", fontWeight: 800, fontSize: 30, lineHeight: 1 }}>3x</div>
          <div style={{ color: "rgba(255,255,255,0.72)", fontWeight: 700, marginTop: 4 }}>More speaking practice</div>
        </div>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({
    goal: "",
    accent: "",
    practiceStyle: "",
    confidence: "",
  });
  const [loadingPct, setLoadingPct] = useState(0);

  const totalSteps = featureSlides.length + questions.length + 3;
  const loadingIndex = featureSlides.length + questions.length;
  const projectionIndex = loadingIndex + 1;
  const finalIndex = projectionIndex + 1;

  const projectionCopy = useMemo(() => getProjectionCopy(answers), [answers]);

  useEffect(() => {
    if (index !== loadingIndex) return;

    setLoadingPct(0);
    const steps = [18, 39, 67, 84, 100];
    let i = 0;

    const timer = setInterval(() => {
      i += 1;
      if (i >= steps.length) {
        clearInterval(timer);
        setLoadingPct(100);
        setTimeout(() => {
          setIndex(projectionIndex);
        }, 450);
        return;
      }
      setLoadingPct(steps[i]);
    }, 550);

    return () => clearInterval(timer);
  }, [index, loadingIndex, projectionIndex]);

  function handleNext() {
    if (index < featureSlides.length - 1) {
      setIndex((v) => v + 1);
      return;
    }

    if (index >= featureSlides.length && index < featureSlides.length + questions.length) {
      const q = questions[index - featureSlides.length];
      if (!answers[q.key]) return;
      setIndex((v) => v + 1);
      return;
    }

    if (index < finalIndex) {
      setIndex((v) => v + 1);
      return;
    }

    saveOnboardingAnswers(answers);
    setOnboardingDone(true);
    navigate("/", { replace: true });
  }

  function handleBack() {
    if (index === 0) return;
    if (index === loadingIndex) return;
    setIndex((v) => Math.max(0, v - 1));
  }

  function renderHero(slide) {
    return (
      <>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
          <div
            style={{
              width: 118,
              height: 118,
              borderRadius: 28,
              background: "#101010",
              border: `1px solid ${BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
            }}
          >
            <Mic2 size={52} color="#fff" />
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 50, fontWeight: 900, lineHeight: 0.98, color: TEXT }}>{slide.titleTop}</div>
          <div style={{ fontSize: 50, fontWeight: 900, lineHeight: 0.98, color: BLUE, marginTop: 4 }}>{slide.titleBottom}</div>
          <div
            style={{
              marginTop: 20,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {slide.subtitle}
          </div>
        </div>

        <div style={{ display: "grid", gap: 18, marginTop: 40 }}>
          {slide.bullets.map((b) => (
            <BulletRow key={b} text={b} />
          ))}
        </div>

        <div style={{ marginTop: "auto", paddingTop: 34 }}>
          <button onClick={handleNext} style={primaryButtonStyle()}>
            <span>{slide.cta}</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </>
    );
  }

  function renderFeature(slide) {
    return (
      <>
        <div style={{ paddingTop: 10 }}>
          <PhoneMockup title={slide.phoneTitle} body={slide.phoneBody} icon={slide.icon} />
        </div>

        <div style={{ textAlign: "center", marginTop: 36 }}>
          <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.06, color: TEXT }}>{slide.title}</div>
          <div style={{ marginTop: 14, fontSize: 18, lineHeight: 1.55, color: MUTED }}>{slide.subtitle}</div>
          <FeatureDots items={slide.dots} />
        </div>

        <div style={{ marginTop: "auto", paddingTop: 34 }}>
          <button onClick={handleNext} style={gradientButtonStyle(slide.icon === "conversation" ? [BLUE, "#6A5AE0"] : ["#D980FA", "#FF6B81"])}>
            <span>{slide.cta}</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </>
    );
  }

  function renderQuestion(q, qIndex) {
    const progressPercent = ((qIndex + 1) / questions.length) * 100;

    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 34 }}>
          <button onClick={handleBack} style={backButtonStyle()}>
            <ArrowLeft size={22} />
          </button>

          <div style={{ flex: 1 }}>
            <ProgressBar value={progressPercent} />
            <div style={{ textAlign: "center", marginTop: 8, color: MUTED, fontWeight: 700 }}>{q.progressLabel}</div>
          </div>

          <div style={{ width: 44 }} />
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 999,
              margin: "0 auto 22px",
              background: "linear-gradient(180deg, rgba(106,90,224,1) 0%, rgba(33,150,243,1) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 30px rgba(33,150,243,0.25)",
            }}
          >
            {q.key === "goal" && <Target size={36} color="#fff" />}
            {q.key === "accent" && <Flag size={36} color="#fff" />}
            {q.key === "practiceStyle" && <AudioLines size={36} color="#fff" />}
            {q.key === "confidence" && <Sparkles size={36} color="#fff" />}
          </div>

          <div style={{ color: MUTED, fontWeight: 800, letterSpacing: "0.16em", fontSize: 13 }}>{q.eyebrow}</div>
          <div style={{ fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: TEXT, marginTop: 14 }}>{q.title}</div>
          <div style={{ fontSize: 18, lineHeight: 1.55, color: MUTED, marginTop: 12 }}>{q.subtitle}</div>
        </div>

        <div style={{ display: "grid", gap: 14, marginTop: 34 }}>
          {q.options.map((opt) => (
            <OptionButton
              key={opt.value}
              emoji={opt.emoji}
              label={opt.label}
              selected={answers[q.key] === opt.value}
              onClick={() => setAnswers((prev) => ({ ...prev, [q.key]: opt.value }))}
            />
          ))}
        </div>

        <div style={{ marginTop: "auto", paddingTop: 30 }}>
          <button
            onClick={handleNext}
            disabled={!answers[q.key]}
            style={primaryButtonStyle(!answers[q.key])}
          >
            <span>{q.cta}</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </>
    );
  }

  function renderLoading() {
    const done1 = loadingPct >= 39;
    const done2 = loadingPct >= 84;
    const active2 = loadingPct >= 39 && loadingPct < 84;
    const active3 = loadingPct >= 84 && loadingPct < 100;

    return (
      <>
        <div style={{ textAlign: "center", paddingTop: 30 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚡</div>
          <div style={{ fontSize: 42, lineHeight: 1.05, fontWeight: 900, color: TEXT }}>Building Your Plan</div>
          <div style={{ fontSize: 18, lineHeight: 1.55, color: MUTED, marginTop: 12 }}>
            This will only take a moment.
          </div>
        </div>

        <div style={{ display: "grid", gap: 22, marginTop: 46 }}>
          <LoadingStep done={done1} active={!done1} label="Analyzing your answers" />
          <LoadingStep done={done2} active={active2} label="Creating personalized training path" />
          <LoadingStep done={loadingPct >= 100} active={active3} label="Optimizing AI feedback" />
        </div>

        <div style={{ marginTop: "auto", paddingTop: 34 }}>
          <ProgressBar value={loadingPct} />
          <div style={{ textAlign: "center", marginTop: 10, color: MUTED, fontWeight: 700 }}>{loadingPct}% Complete</div>
        </div>
      </>
    );
  }

  function renderProjection() {
    return (
      <>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 999,
              margin: "0 auto 22px",
              background: "rgba(46,204,113,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(46,204,113,0.2)",
            }}
          >
            <Sparkles size={34} color="#53F07C" />
          </div>

          <div style={{ fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: TEXT }}>Your Speaking Potential</div>
          <div style={{ fontSize: 18, lineHeight: 1.55, color: MUTED, marginTop: 12 }}>
            See how FluentUp can accelerate your speaking journey.
          </div>
        </div>

        <div
          style={{
            marginTop: 30,
            background: "rgba(33,150,243,0.08)",
            border: `1px solid rgba(33,150,243,0.12)`,
            borderRadius: 24,
            padding: 22,
          }}
        >
          <div style={{ color: "#EAF4FF", fontSize: 20, lineHeight: 1.65, fontWeight: 600 }}>
            {projectionCopy.paragraph}
          </div>
        </div>

        <div style={{ marginTop: 30 }}>
          <div style={{ color: TEXT, fontSize: 28, fontWeight: 900, marginBottom: 18 }}>6-Week Progress Projection</div>
          <ProjectionChart />
        </div>

        <div style={{ display: "grid", gap: 18, marginTop: 26 }}>
          <BenefitRow text={projectionCopy.stat1} />
          <BenefitRow text={projectionCopy.stat2} />
          <BenefitRow text="Real-time speaking feedback and guided practice" />
        </div>

        <div style={{ marginTop: "auto", paddingTop: 30 }}>
          <button onClick={handleNext} style={primaryButtonStyle()}>
            <span>Continue</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </>
    );
  }

  function renderFinal() {
    return (
      <>
        <div style={{ textAlign: "center", paddingTop: 22 }}>
          <div style={{ fontSize: 40, lineHeight: 1.05, fontWeight: 900, color: TEXT }}>Start Speaking Better Today</div>
          <div style={{ fontSize: 18, lineHeight: 1.55, color: MUTED, marginTop: 12 }}>
            Your personalized path is ready.
          </div>
        </div>

        <div style={{ display: "grid", gap: 18, marginTop: 40 }}>
          <BulletRow text="Personalized training plan" />
          <BulletRow text="Real-time pronunciation feedback" />
          <BulletRow text="AI conversation practice" />
        </div>

        <div
          style={{
            marginTop: 28,
            background: CARD,
            borderRadius: 24,
            border: `1px solid ${BORDER}`,
            padding: 18,
          }}
        >
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 18, marginBottom: 14 }}>Your focus</div>
          <div style={{ display: "grid", gap: 10 }}>
            <SmallInfoRow icon={<Target size={16} />} label="Goal" value={labelForAnswer("goal", answers.goal)} />
            <SmallInfoRow icon={<Flag size={16} />} label="Accent" value={labelForAnswer("accent", answers.accent)} />
            <SmallInfoRow icon={<AudioLines size={16} />} label="Practice style" value={labelForAnswer("practiceStyle", answers.practiceStyle)} />
            <SmallInfoRow icon={<Sparkles size={16} />} label="Confidence" value={labelForAnswer("confidence", answers.confidence)} />
          </div>
        </div>

        <div style={{ marginTop: "auto", paddingTop: 30 }}>
          <button onClick={handleNext} style={primaryButtonStyle()}>
            <span>Continue Your Journey</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </>
    );
  }

  function renderStep() {
    if (index < featureSlides.length) {
      const slide = featureSlides[index];
      if (slide.type === "hero") return renderHero(slide);
      return renderFeature(slide);
    }

    if (index >= featureSlides.length && index < featureSlides.length + questions.length) {
      const qIndex = index - featureSlides.length;
      return renderQuestion(questions[qIndex], qIndex);
    }

    if (index === loadingIndex) return renderLoading();
    if (index === projectionIndex) return renderProjection();
    return renderFinal();
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: BG,
        color: TEXT,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          minHeight: "100dvh",
          padding: "22px 20px 26px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {renderStep()}
      </div>
    </div>
  );
}

function BenefitRow({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
      <div
        style={{
          width: 28,
          height: 28,
          minWidth: 28,
          borderRadius: 999,
          border: "1px solid rgba(83,240,124,0.28)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#53F07C",
        }}
      >
        <CheckCircle2 size={16} />
      </div>
      <div style={{ color: "#fff", fontSize: 18, lineHeight: 1.45, fontWeight: 600 }}>{text}</div>
    </div>
  );
}

function SmallInfoRow({ icon, label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "20px 110px 1fr",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div style={{ color: "#A7D6FF" }}>{icon}</div>
      <div style={{ color: "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 14 }}>{label}</div>
      <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, textAlign: "right" }}>{value || "-"}</div>
    </div>
  );
}

function labelForAnswer(key, value) {
  const all = [...questions];
  const group = all.find((q) => q.key === key);
  if (!group) return value || "";
  const opt = group.options.find((o) => o.value === value);
  return opt ? opt.label : value || "";
}

function primaryButtonStyle(disabled = false) {
  return {
    width: "100%",
    height: 62,
    borderRadius: 20,
    border: "none",
    background: disabled ? "rgba(33,150,243,0.25)" : BLUE,
    color: "#fff",
    fontSize: 22,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    boxShadow: disabled ? "none" : "0 10px 26px rgba(33,150,243,0.26)",
  };
}

function gradientButtonStyle(colors) {
  return {
    width: "100%",
    height: 62,
    borderRadius: 20,
    border: "none",
    background: `linear-gradient(90deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
    color: "#fff",
    fontSize: 22,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    cursor: "pointer",
    boxShadow: "0 10px 26px rgba(0,0,0,0.28)",
  };
}

function backButtonStyle() {
  return {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    background: "#151515",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  };
}