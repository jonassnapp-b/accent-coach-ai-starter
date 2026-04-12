// src/pages/Onboarding.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Target, Sparkles, Flag, Circle, Check, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { saveOnboardingAnswers, setOnboardingDone } from "../lib/onboarding.js";
import { useSettings } from "../lib/settings-store.jsx";
import fluentUpLogo from "../assets/Logo_Arrow.png";
import appScreenshot1 from "../assets/app_screenshot1.png";
import appScreenshot2 from "../assets/app_screenshot2.png";
import chatIcon from "../assets/onboarding/chat.png";
import waveIcon from "../assets/onboarding/wave.png";
import docIcon from "../assets/onboarding/doc.png";
import review1Img from "../assets/onboarding/review1.png";
import review2Img from "../assets/onboarding/review2.png";
import review3Img from "../assets/onboarding/review3.png";
import { registerPlugin } from "@capacitor/core";
const ReviewPrompt = registerPlugin("ReviewPrompt");
const BLUE = "#2F54EB";
const ORANGE = "#FF9800";
const BG = "#F3F3F3";
const CARD = "#FFFFFF";
const CARD_2 = "#FFFFFF";
const BORDER = "rgba(0,0,0,0.08)";
const TEXT = "#000000";
const MUTED = "rgba(0,0,0,0.68)";
const HERO_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

const featureSlides = [
 {
  type: "hero",
  rotatingWords: [
    "Sound fluent",
    "Sound natural",
    "Speak like a native",
    "Perfect pronunciation",
  ],
  brandTitle: "Fluentup",
  subtitle: "Your AI accent practice partner",
  cta: "Get Started",
},
{
  type: "accent",
  title: "What accent do you want to practice?",
  cta: "Continue",
  options: [
    { value: "american", label: "American", emoji: "🇺🇸" },
    { value: "british", label: "British", emoji: "🇬🇧" },
  ],
},
{
  type: "accentLevel",
  cta: "Continue",
  options: [
    {
      value: "beginner",
      title: "Level 1: Beginner",
      subtitleAmerican: "My American accent is still quite strong and I want to improve the basics.",
      subtitleBritish: "My British accent is still quite strong and I want to improve the basics.",
      dots: 1,
    },
    {
      value: "developing",
      title: "Level 2: Developing",
      subtitleAmerican: "I can speak clearly enough, but my American accent still needs a lot of work.",
      subtitleBritish: "I can speak clearly enough, but my British accent still needs a lot of work.",
      dots: 2,
    },
    {
      value: "intermediate",
      title: "Level 3: Intermediate",
      subtitleAmerican: "My American accent is improving, but it is still noticeable in everyday speech.",
      subtitleBritish: "My British accent is improving, but it is still noticeable in everyday speech.",
      dots: 3,
    },
    {
      value: "advanced",
      title: "Level 4: Advanced",
      subtitleAmerican: "My American accent is fairly good, but I still want to sound more natural.",
      subtitleBritish: "My British accent is fairly good, but I still want to sound more natural.",
      dots: 4,
    },
    {
      value: "fluent",
      title: "Level 5: Fluent",
      subtitleAmerican: "My American accent is already strong, and I mainly want to refine small details.",
      subtitleBritish: "My British accent is already strong, and I mainly want to refine small details.",
      dots: 5,
    },
  ],
},
];

const questions = [
  {
    key: "goal",
    progressLabel: "1 of 4",
    eyebrow: "",
    title: "Why do you want to improve your accent?",
    subtitle: "",
    cta: "Continue",
    options: [
      { value: "natural", label: "Sound more natural", emoji: "🗣️" },
      { value: "clear", label: "Be easier to understand", emoji: "🎯" },
      { value: "confidence", label: "Feel more confident speaking", emoji: "⚡" },
      { value: "conversations", label: "Handle real conversations better", emoji: "💬" },
      { value: "pronunciation", label: "Improve my pronunciation", emoji: "🎯" },
      { value: "work", label: "Improve for work or studies", emoji: "💼" },
    ],
  },
  {
  key: "speedCompare",
  progressLabel: "2 of 4",
  eyebrow: "",
  title: "Improve faster with FluentUp than practicing alone",
  subtitle: "",
  cta: "Continue",
},
{
  key: "threeMonths",
  progressLabel: "3 of 5",
  eyebrow: "",
  title: "Here’s what you can achieve in 3 months!",
  subtitle: "",
  cta: "Continue",
},
{
  key: "ratingPrompt",
  progressLabel: "4 of 5",
  eyebrow: "",
  title: "Give us a rating",
  subtitle: "",
  cta: "Continue",
},
{
  key: "dailyGoal",
  progressLabel: "5 of 5",
    eyebrow: "",
    title: "What’s your daily learning goal?",
    subtitle: "",
    cta: "Continue",
    options: [
      { value: "5", left: "5 min / day", right: "Casual" },
      { value: "10", left: "10 min / day", right: "Regular" },
      { value: "15", left: "15 min / day", right: "Serious" },
      { value: "20", left: "20 min / day", right: "Dedicated" },
    ],
  },
  {
  key: "notificationPrompt",
  progressLabel: "6 of 6",
  eyebrow: "",
  title: "Reach your speaking goals with practice reminders",
  subtitle: "",
  cta: "Remind Me",
},
];

function getProjectionCopy(answers) {
  const goal = answers.goal || "natural";

  if (goal === "conversations") {
    return {
      paragraph:
        "FluentUp will help you handle real conversations better with real-time pronunciation feedback, guided AI speaking practice, and training that makes your speech feel more natural in everyday situations.",
      stat1: "Better real conversation flow",
      stat2: "More natural speaking under pressure",
    };
  }

  if (goal === "sounds") {
    return {
      paragraph:
        "FluentUp will help you fix your weakest sounds with targeted pronunciation training, daily drills, and detailed feedback that shows you exactly what to improve so your accent becomes cleaner step by step.",
      stat1: "Stronger sound-by-sound accuracy",
      stat2: "More precise accent training",
    };
  }

  if (goal === "confidence") {
    return {
      paragraph:
        "FluentUp will help you feel more confident speaking by giving you instant feedback, guided speaking practice, and repetition that makes pronunciation feel more automatic and less stressful.",
      stat1: "More speaking confidence",
      stat2: "Less hesitation when speaking",
    };
  }

  if (goal === "work") {
    return {
      paragraph:
        "FluentUp will help you improve your accent for work or studies with personalized speaking practice, clearer pronunciation feedback, and training that helps you sound more polished and professional.",
      stat1: "More professional speech",
      stat2: "Clearer communication at work",
    };
  }

  if (goal === "clear") {
    return {
      paragraph:
        "FluentUp will help you become easier to understand with targeted pronunciation feedback, focused speaking drills, and AI practice that improves clarity every time you speak.",
      stat1: "Clearer speech",
      stat2: "Better pronunciation accuracy",
    };
  }

  return {
    paragraph:
      "FluentUp will help you sound more natural with personalized pronunciation feedback, real speaking practice, and targeted drills that make your accent smoother and more native-like over time.",
    stat1: "More natural accent",
    stat2: "Smoother everyday speech",
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
          transition: "width 90ms linear",
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

function PhoneMockup({ screenshot }) {
  return (
    <div
      style={{
        width: 232,
        maxWidth: "69vw",
        margin: "14px auto 0",
      }}
    >
      <img
        src={screenshot}
        alt="App preview"
        style={{
          width: "100%",
          display: "block",
          borderRadius: 34,
          boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
        }}
      />
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
        borderRadius: 18,
        padding: "16px 18px",
        border: selected ? `1.5px solid ${BLUE}` : "1px solid rgba(0,0,0,0.04)",
        background: selected ? "rgba(47,84,235,0.08)" : "#EAEAEA",
        color: TEXT,
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: "pointer",
        boxShadow: "none",
        fontFamily: HERO_FONT,
      }}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }}>{emoji}</span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 500,
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          fontFamily: HERO_FONT,
        }}
      >
        {label}
      </span>
    </button>
  );
}
function AccentOptionCard({ selected, emoji, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 114,
        borderRadius: 24,
        border: selected ? `1.5px solid ${BLUE}` : "1px solid rgba(0,0,0,0.04)",
        background: "#EAEAEA",
        padding: "0 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        fontFamily: HERO_FONT,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 999,
            background: "#F3F3F3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {emoji}
        </div>

        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: "#111111",
            letterSpacing: "-0.03em",
            fontFamily: HERO_FONT,
          }}
        >
          {label}
        </div>
      </div>

      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          border: selected ? "none" : "1.5px solid rgba(0,0,0,0.12)",
          background: selected ? BLUE : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {selected ? <Check size={15} strokeWidth={3} /> : null}
      </div>
    </button>
  );
}

function AccentLevelCard({ selected, title, subtitle, dots, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 22,
        border: selected ? `1.5px solid ${BLUE}` : "1px solid rgba(0,0,0,0.04)",
        background: "#EAEAEA",
        padding: "18px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: "pointer",
        fontFamily: HERO_FONT,
      }}
    >
      <div
        style={{
          width: 68,
          height: 68,
          minWidth: 68,
          borderRadius: 999,
          background: "#F4F4F4",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 4,
            alignItems: "center",
            justifyItems: "center",
          }}
        >
          {Array.from({ length: dots }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "#1F1F1F",
                display: "block",
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 20,
            lineHeight: 1.02,
            fontWeight: 700,
            color: "#111111",
            letterSpacing: "-0.03em",
            fontFamily: HERO_FONT,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 14,
            lineHeight: 1.15,
            fontWeight: 500,
            color: "#222222",
            letterSpacing: "-0.02em",
            fontFamily: HERO_FONT,
          }}
        >
          {subtitle}
        </div>
      </div>
    </button>
  );
}

function PingoGoalOptionButton({ selected, emoji, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 74,
        borderRadius: 20,
        border: "1px solid rgba(0,0,0,0.03)",
        background: selected ? "rgba(47,84,235,0.10)" : "#EAEAEA",
        padding: "0 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: "pointer",
        fontFamily: HERO_FONT,
        boxShadow: "none",
      }}
    >
      <div
        style={{
          width: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {emoji}
      </div>

      <div
        style={{
          fontSize: 18,
          lineHeight: 1.12,
          fontWeight: 500,
          color: "#111111",
          letterSpacing: "-0.025em",
          textAlign: "left",
          fontFamily: HERO_FONT,
        }}
      >
        {label}
      </div>
    </button>
  );
}

function DailyGoalOptionCard({ selected, left, right, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 86,
        borderRadius: 24,
        border: "none",
        background: selected ? "#141414" : "#EAEAEA",
        padding: "0 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        fontFamily: HERO_FONT,
        boxShadow: "none",
      }}
    >
      <div
        style={{
          fontSize: 22,
          lineHeight: 1.05,
          fontWeight: 500,
          color: selected ? "#FFFFFF" : "#111111",
          letterSpacing: "-0.035em",
          fontFamily: HERO_FONT,
        }}
      >
        {left}
      </div>

      <div
        style={{
          fontSize: 16,
          lineHeight: 1.1,
          fontWeight: 400,
          color: selected ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.62)",
          letterSpacing: "-0.03em",
          fontFamily: HERO_FONT,
          textAlign: "right",
        }}
      >
        {right}
      </div>
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
  const width = 320;
  const height = 300;
  const left = 20;
  const right = 302;
  const bottom = 184;

  const blackPath = `M ${left} ${bottom} C 72 ${184}, 112 ${162}, 160 ${130} C 214 ${80}, 258 ${48}, ${right} 32`;
  const redPath = `M ${left} ${bottom} C 82 ${184}, 134 ${176}, 188 ${158} C 236 ${142}, 272 ${132}, ${right} 128`;

  return (
    <div
      style={{
        background: "#EAEAEA",
        borderRadius: 34,
        padding: "26px 20px 14px",
        minHeight: 0,
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      >
        <line
          x1="20"
          y1="86"
          x2="304"
          y2="86"
          stroke="rgba(0,0,0,0.10)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />
        <line
          x1="20"
          y1="162"
          x2="304"
          y2="162"
          stroke="rgba(0,0,0,0.10)"
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />
        <line
          x1="20"
          y1={bottom}
          x2="304"
          y2={bottom}
          stroke="rgba(0,0,0,0.22)"
          strokeWidth="2"
        />

        <path d={blackPath} fill="none" stroke="#111111" strokeWidth="4.5" strokeLinecap="round" />
        <path d={redPath} fill="none" stroke="#F26D6D" strokeWidth="4.5" strokeLinecap="round" />

        <circle cx={left} cy={bottom} r="8.5" fill="#FFFFFF" stroke="#111111" strokeWidth="4" />
        <circle cx={right} cy="32" r="8.5" fill="#FFFFFF" stroke="#111111" strokeWidth="4" />
        <circle cx={right} cy="128" r="8.5" fill="#FFFFFF" stroke="#F26D6D" strokeWidth="4" />

        <g transform="translate(222, -6)">
          <image
            href={fluentUpLogo}
            x="0"
            y="0"
            width="104"
            height="38"
            preserveAspectRatio="xMidYMid meet"
          />
        </g>

        <text
          x="212"
          y="108"
          fill="#111111"
          fontSize="15"
          fontWeight="700"
          fontFamily={HERO_FONT}
          letterSpacing="-0.02em"
        >
          Other methods
        </text>

        <text
          x="22"
          y="224"
          fill="#111111"
          fontSize="16"
          fontWeight="800"
          fontFamily={HERO_FONT}
          letterSpacing="-0.02em"
        >
          Week 1
        </text>

        <text
          x="248"
          y="224"
          fill="#111111"
          fontSize="16"
          fontWeight="800"
          fontFamily={HERO_FONT}
          letterSpacing="-0.02em"
        >
          Month 6
        </text>

        <text
          x="30"
          y="250"
          fill="#111111"
          fontSize="14"
          fontWeight="500"
          fontFamily={HERO_FONT}
          letterSpacing="-0.02em"
        >
          90% of FluentUp users improve their accent
        </text>
        <text
          x="30"
          y="268"
          fill="#111111"
          fontSize="14"
          fontWeight="500"
          fontFamily={HERO_FONT}
          letterSpacing="-0.02em"
        >
          clarity and speaking confidence over time
        </text>
      </svg>
    </div>
  );
}
function SpeedCompareCard() {
  return (
    <div
      style={{
        background: "#EAEAEA",
        borderRadius: 34,
        padding: "22px 18px 14px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          alignItems: "end",
        }}
      >
        <div
          style={{
            background: "#F3F3F3",
            borderRadius: 28,
            padding: "18px 14px 14px",
            minHeight: 300,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: 18,
              lineHeight: 1.2,
              fontWeight: 700,
              color: "#111111",
              letterSpacing: "-0.03em",
              fontFamily: HERO_FONT,
            }}
          >
            Without
            <br />
            FluentUp
          </div>

          <div
            style={{
              width: "100%",
              height: 48,
              borderRadius: 999,
              background: "#DCDCDC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
              color: "#111111",
              letterSpacing: "-0.03em",
              fontFamily: HERO_FONT,
            }}
          >
            Slower
          </div>
        </div>

        <div
          style={{
            background: "#F3F3F3",
            borderRadius: 28,
            padding: "18px 14px 14px",
            minHeight: 300,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: 18,
              lineHeight: 1.2,
              fontWeight: 700,
              color: "#111111",
              letterSpacing: "-0.03em",
              fontFamily: HERO_FONT,
            }}
          >
            With
            <br />
            FluentUp
          </div>

          <div
            style={{
              width: "100%",
              height: 200,
              borderRadius: 28,
              background: "#2196F3",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 14,
              fontSize: 20,
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: "-0.03em",
              fontFamily: HERO_FONT,
            }}
          >
            Faster
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          textAlign: "center",
          fontSize: 15,
          lineHeight: 1.15,
          fontWeight: 500,
          color: "#111111",
          letterSpacing: "-0.03em",
          fontFamily: HERO_FONT,
        }}
      >
        FluentUp offers unlimited, stress-free
        <br />
        accent practice with instant feedback
      </div>
    </div>
  );
}
function LoadingCircle({ value }) {
  const size = 180;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E9E9E9"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2F54EB"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#2F54EB"
          style={{
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            fontFamily: HERO_FONT,
          }}
        >
          {value}%
        </text>
      </svg>
    </div>
  );
}

function LoadingMiniSpinner() {
  const size = 42;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const visibleArc = circumference * 0.34;
  const hiddenArc = circumference - visibleArc;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        display: "block",
        animation: "miniSpinnerRotate 0.95s linear infinite",
      }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#2F54EB"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${visibleArc} ${hiddenArc}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function LoadingChecklistRow({ state, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {state === "done" ? (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "#2F54EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <Check size={18} strokeWidth={3} />
          </div>
        ) : state === "active" ? (
          <LoadingMiniSpinner />
        ) : null}
      </div>

      <div
        style={{
          fontSize: 18,
          lineHeight: 1.2,
          fontWeight: 500,
          color: "#111111",
          letterSpacing: "-0.03em",
          fontFamily: HERO_FONT,
        }}
      >
        {text}
      </div>
    </div>
  );
}
function ThreeMonthsCard() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
     <div
  style={{
    background: "#EAEAEA",
    borderRadius: 30,
    padding: "14px 18px",
    display: "grid",
    gridTemplateColumns: "64px 1fr",
    gap: 14,
    alignItems: "center",
  }}
>
       <div
  style={{
   width: 64,
height: 64,
    borderRadius: 999,
    background: "#F3F3F3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }}
>
  <img
    src={chatIcon}
    alt="Chat icon"
    style={{
     width: 30,
height: 30,
      objectFit: "contain",
      display: "block",
    }}
  />
</div>

        <div>
          <div
            style={{
            fontSize: 25,
lineHeight: 0.98,
              fontWeight: 700,
              color: "#111111",
              letterSpacing: "-0.04em",
              fontFamily: HERO_FONT,
            }}
          >
            Speak with
            <br />
            more confidence
          </div>

          <div
            style={{
           marginTop: 6,
fontSize: 16,
lineHeight: 1.12,
              fontWeight: 500,
              color: "#111111",
              letterSpacing: "-0.03em",
              fontFamily: HERO_FONT,
            }}
          >
            Feel calmer and more natural
            <br />
            in everyday conversations.
          </div>
        </div>
      </div>

    <div
  style={{
    background: "#EAEAEA",
    borderRadius: 30,
    padding: "14px 18px",
    display: "grid",
    gridTemplateColumns: "64px 1fr",
    gap: 14,
    alignItems: "center",
  }}
>
        <div
  style={{
    width: 64,
height: 64,
    borderRadius: 999,
    background: "#F3F3F3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }}
>
  <img
    src={waveIcon}
    alt="Wave icon"
    style={{
      width: 30,
height: 30,
      objectFit: "contain",
      display: "block",
    }}
  />
</div>

        <div>
          <div
            style={{
          fontSize: 25,
lineHeight: 0.98,
              fontWeight: 700,
              color: "#111111",
              letterSpacing: "-0.04em",
              fontFamily: HERO_FONT,
            }}
          >
            Smoother,
            <br />
            more fluent speech
          </div>

          <div
            style={{
             marginTop: 6,
fontSize: 16,
lineHeight: 1.12,
              fontWeight: 500,
              color: "#111111",
              letterSpacing: "-0.03em",
              fontFamily: HERO_FONT,
            }}
          >
            Build a more natural rhythm
            <br />
            and flow when speaking.
          </div>
        </div>
      </div>

    <div
  style={{
    background: "#EAEAEA",
    borderRadius: 30,
    padding: "14px 18px",
    display: "grid",
    gridTemplateColumns: "64px 1fr",
    gap: 14,
    alignItems: "center",
  }}
>
       <div
  style={{
    width: 64,
height: 64,
    borderRadius: 999,
    background: "#F3F3F3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }}
>
  <img
    src={docIcon}
    alt="Document icon"
    style={{
     width: 30,
height: 30,
      objectFit: "contain",
      display: "block",
    }}
  />
</div>

        <div>
          <div
            style={{
            fontSize: 25,
lineHeight: 0.98,
              fontWeight: 700,
              color: "#111111",
              letterSpacing: "-0.04em",
              fontFamily: HERO_FONT,
            }}
          >
            Clearer
            <br />
            pronunciation
          </div>

          <div
            style={{
           marginTop: 6,
fontSize: 16,
lineHeight: 1.12,
              fontWeight: 500,
              color: "#111111",
              letterSpacing: "-0.03em",
              fontFamily: HERO_FONT,
            }}
          >
            Sound easier to understand
            <br />
            in real situations.
          </div>
        </div>
      </div>
    </div>
  );
}
export default function Onboarding() {
  const navigate = useNavigate();
  const { setSettings } = useSettings();
  const scrollRef = React.useRef(null);
  const [index, setIndex] = useState(0);
 const [answers, setAnswers] = useState({
  goal: "",
  dailyGoal: "",
  accent: "",
  accentLevel: "",
});
  const [loadingPct, setLoadingPct] = useState(0);
  const [heroWordIndex, setHeroWordIndex] = useState(0);
  const [heroTypedText, setHeroTypedText] = useState("");
  const [heroCursorVisible, setHeroCursorVisible] = useState(true);
  const [hasTriggeredReviewPrompt, setHasTriggeredReviewPrompt] = useState(false);

const totalSteps = featureSlides.length + questions.length + 3;

const goalIndex = featureSlides.length;
const speedCompareIndex = featureSlides.length + 1;
const threeMonthsIndex = featureSlides.length + 2;
const ratingIndex = featureSlides.length + 3;
const dailyGoalIndex = featureSlides.length + 4;
const notificationPromptIndex = featureSlides.length + 5;

const projectionIndex = featureSlides.length + questions.length;
const finalIndex = projectionIndex + 1;
const loadingIndex = finalIndex + 1;

  const projectionCopy = useMemo(() => getProjectionCopy(answers), [answers]);


useEffect(() => {
  const prevHtmlBg = document.documentElement.style.background;
  const prevBodyBg = document.body.style.background;
  const prevHtmlOverflow = document.documentElement.style.overflow;
  const prevBodyOverflow = document.body.style.overflow;
  const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
  const prevBodyOverscroll = document.body.style.overscrollBehavior;

  document.documentElement.style.background = BG;
  document.body.style.background = BG;
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.documentElement.style.overscrollBehavior = "none";
  document.body.style.overscrollBehavior = "none";

  return () => {
    document.documentElement.style.background = prevHtmlBg;
    document.body.style.background = prevBodyBg;
    document.documentElement.style.overflow = prevHtmlOverflow;
    document.body.style.overflow = prevBodyOverflow;
    document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
    document.body.style.overscrollBehavior = prevBodyOverscroll;
  };
}, []);

useEffect(() => {
  if (!scrollRef.current) return;
  scrollRef.current.scrollTo({ top: 0, behavior: "auto" });
}, [index]);
useEffect(() => {
  if (index !== 0) return;

  const blinkInterval = setInterval(() => {
    setHeroCursorVisible((prev) => !prev);
  }, 530);

  return () => clearInterval(blinkInterval);
}, [index]);

useEffect(() => {
  if (index !== 0) return;

  const words = featureSlides[0]?.rotatingWords || [];
  if (!words.length) return;

  let cancelled = false;
  let timeoutId;

  async function pulseHaptic() {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(8);
      }
    } catch {}
  }

  function schedule(ms, fn) {
    timeoutId = setTimeout(fn, ms);
  }

  function typeWord(wordIndex) {
    const word = words[wordIndex];
    let charIndex = 0;

    setHeroWordIndex(wordIndex);
    setHeroTypedText("");

    function typeNext() {
      if (cancelled) return;

      charIndex += 1;
      setHeroTypedText(word.slice(0, charIndex));
      pulseHaptic();

      if (charIndex < word.length) {
        schedule(68, typeNext);
      } else {
        schedule(950, () => eraseWord(wordIndex, word.length));
      }
    }

    schedule(90, typeNext);
  }

  function eraseWord(wordIndex, currentLength) {
    let charIndex = currentLength;

    function eraseNext() {
      if (cancelled) return;

      charIndex -= 1;
      setHeroTypedText(words[wordIndex].slice(0, charIndex));

      if (charIndex > 0) {
        schedule(32, eraseNext);
      } else {
        const nextIndex = (wordIndex + 1) % words.length;
        schedule(220, () => typeWord(nextIndex));
      }
    }

    schedule(35, eraseNext);
  }

  setHeroTypedText("");
  setHeroWordIndex(0);
  typeWord(0);

  return () => {
    cancelled = true;
    clearTimeout(timeoutId);
  };
}, [index]);
useEffect(() => {
  if (index !== loadingIndex) return;

  let cancelled = false;
  let frameId = null;
  let lastHapticPct = -1;

  setLoadingPct(0);

  async function pulseTick() {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(6);
      }
    } catch {}
  }

  const durationMs = 6800;
  const start = performance.now();

  function step(now) {
    if (cancelled) return;

    const elapsed = now - start;
    const raw = Math.min(elapsed / durationMs, 1);
    const eased = 1 - Math.pow(1 - raw, 3);
    const pct = Math.round(eased * 100);

    setLoadingPct(pct);

    const steppedPct = Math.floor(pct / 4);
    if (steppedPct !== lastHapticPct && pct < 100) {
      lastHapticPct = steppedPct;
      pulseTick();
    }

    if (raw < 1) {
      frameId = requestAnimationFrame(step);
      return;
    }

    setLoadingPct(100);

    setTimeout(() => {
      if (!cancelled) {
        setIndex(threeMonthsIndex);
      }
    }, 500);
  }

  frameId = requestAnimationFrame(step);

  return () => {
    cancelled = true;
    if (frameId) cancelAnimationFrame(frameId);
  };
}, [index, loadingIndex, threeMonthsIndex]);
useEffect(() => {
  if (index !== ratingIndex) return;
  if (hasTriggeredReviewPrompt) return;

  console.log("[Review] entered rating slide", { index, ratingIndex });

  const timer = setTimeout(async () => {
    console.log("[Review] timeout fired");
    setHasTriggeredReviewPrompt(true);
    await requestAppReviewPrompt();
  }, 900);

  return () => {
    console.log("[Review] cleanup before timeout fired");
    clearTimeout(timer);
  };
}, [index, ratingIndex, hasTriggeredReviewPrompt]);
function getFirstRouteFromGoal() {
  return "/conversation-coach";
}

  function getAccentDefaultFromAnswer(accentAnswer) {
    return accentAnswer === "british" ? "en_br" : "en_us";
  }

async function handleNext() {
  await pulseContinueHaptic();
  if (index < featureSlides.length) {
    const slide = featureSlides[index];

    if (slide.type === "accent" && !answers.accent) return;
    if (slide.type === "accentLevel" && !answers.accentLevel) return;

    setIndex((v) => v + 1);
    return;
  }

  if (index >= featureSlides.length && index < featureSlides.length + questions.length) {
    const qIndex = index - featureSlides.length;
    const q = questions[qIndex];

    if (q.key === "goal") {
      if (!answers[q.key]) return;
      setIndex(projectionIndex);
      return;
    }

    if (q.key === "speedCompare") {
      setIndex(loadingIndex);
      return;
    }

if (q.key === "threeMonths") {
  setIndex(ratingIndex);
  return;
}

if (q.key === "ratingPrompt") {
  setIndex(notificationPromptIndex);
  return;
}

if (q.key === "dailyGoal") {
  if (!answers[q.key]) return;
  setIndex(speedCompareIndex);
  return;
}

    if (!answers[q.key]) return;
    setIndex((v) => v + 1);
    return;
  }

  if (index === projectionIndex) {
  setIndex(dailyGoalIndex);
  return;
}
if (index === speedCompareIndex) {
  setIndex(loadingIndex);
  return;
}

if (index === loadingIndex) {
  setIndex(threeMonthsIndex);
  return;
}

if (index === threeMonthsIndex) {
  setIndex(notificationPromptIndex);
  return;
}

if (index === notificationPromptIndex) {
  setIndex((v) => v + 1);
  return;
}
  if (index < finalIndex) {
    setIndex((v) => v + 1);
    return;
  }

  saveOnboardingAnswers(answers);

  setSettings((prev) => ({
    ...prev,
    accentDefault: getAccentDefaultFromAnswer(answers.accent),
  }));

  setOnboardingDone(true);
  navigate(getFirstRouteFromGoal(answers.goal), { replace: true });
}

function handleBack() {
  if (index === 0) return;

  if (index === projectionIndex) {
    setIndex(goalIndex);
    return;
  }

  if (index === speedCompareIndex) {
  setIndex(dailyGoalIndex);
  return;
}

  if (index === loadingIndex) {
    setIndex(speedCompareIndex);
    return;
  }

 if (index === threeMonthsIndex) {
  setIndex(speedCompareIndex);
  return;
}
if (index === notificationPromptIndex) {
  setIndex(threeMonthsIndex);
  return;
}
if (index === ratingIndex) {
  setIndex(threeMonthsIndex);
  return;
}

if (index === dailyGoalIndex) {
  setIndex(projectionIndex);
  return;
}
if (index === notificationPromptIndex) {
  setIndex(dailyGoalIndex);
  return;
}
  setIndex((v) => Math.max(0, v - 1));
}
async function pulseOptionHaptic() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(8);
    }
  } catch {}
}
async function pulseContinueHaptic() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(12);
    }
  } catch {}
}
async function requestAppReviewPrompt() {
  try {
    console.log("[Review] start");
    console.log("[Review] isNative =", Capacitor.isNativePlatform());

    if (!Capacitor.isNativePlatform()) {
      console.log("[Review] aborted: not native");
      return;
    }

    const result = await ReviewPrompt.requestReview();
    console.log("[Review] success", result);
  } catch (err) {
    console.log("[Review] native requestReview failed", err);
  }
}
async function requestNotificationPermissionAndContinue() {
  try {
    if (Capacitor.isNativePlatform()) {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await PushNotifications.requestPermissions();
    }
  } catch (err) {
    console.log("[Notifications] requestPermissions failed", err);
  }

  saveOnboardingAnswers(answers);

setSettings((prev) => ({
  ...prev,
  accentDefault: getAccentDefaultFromAnswer(answers.accent),
}));

setOnboardingDone(true);
navigate(getFirstRouteFromGoal(answers.goal), { replace: true });
}
function renderNotificationPromptQuestionPingo(q) {
  const progressPercent = 100;

  return (
    <>
      <div style={{ marginTop: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={handleBack} style={pingoAccentBackButtonStyle()}>
            <ArrowLeft size={28} strokeWidth={2.6} />
          </button>

          <div
            style={{
              flex: 1,
              height: 24,
              background: "#D9D9D9",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "#1F1F1F",
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 34,
          fontSize: 34,
          lineHeight: 1.14,
          fontWeight: 700,
          color: "#000000",
          letterSpacing: "-0.04em",
          fontFamily: HERO_FONT,
          maxWidth: 360,
        }}
      >
        {q.title}
      </div>

      <div style={{ marginTop: 42, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            position: "relative",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 28,
              border: "1px solid rgba(0,0,0,0.08)",
              overflow: "hidden",
              boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                padding: "28px 24px 24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  lineHeight: 1.25,
                  fontWeight: 700,
                  color: "#111111",
                  fontFamily: HERO_FONT,
                }}
              >
                “FluentUp” Would Like to Send
                <br />
                You Notifications
              </div>

              <div
                style={{
                  marginTop: 14,
                  fontSize: 14,
                  lineHeight: 1.35,
                  fontWeight: 500,
                  color: "rgba(0,0,0,0.72)",
                  fontFamily: HERO_FONT,
                }}
              >
                Notifications may include practice reminders,
                <br />
                daily streak alerts, and lesson updates.
              </div>
            </div>

            <div
              style={{
                height: 1,
                background: "rgba(0,0,0,0.08)",
              }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                minHeight: 62,
              }}
            >
              <button
                onClick={() => {
  saveOnboardingAnswers(answers);

  setSettings((prev) => ({
    ...prev,
    accentDefault: getAccentDefaultFromAnswer(answers.accent),
  }));

  setOnboardingDone(true);
  navigate(getFirstRouteFromGoal(answers.goal), { replace: true });
}}
                style={{
                  border: "none",
                  background: "#FFFFFF",
                  fontSize: 18,
                  fontWeight: 500,
                  color: "rgba(0,0,0,0.38)",
                  fontFamily: HERO_FONT,
                  cursor: "pointer",
                }}
              >
                Don’t Allow
              </button>

              <button
                onClick={requestNotificationPermissionAndContinue}
                style={{
                  border: "none",
                  borderLeft: "1px solid rgba(0,0,0,0.08)",
                  background: "#FFFFFF",
                  fontSize: 18,
                  fontWeight: 500,
                  color: "#111111",
                  fontFamily: HERO_FONT,
                  cursor: "pointer",
                }}
              >
                Allow
              </button>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              right: 58,
              bottom: -62,
              fontSize: 34,
              animation: "fingerFloat 1.8s ease-in-out infinite",
              pointerEvents: "none",
            }}
          >
            👆
          </div>
        </div>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <button onClick={requestNotificationPermissionAndContinue} style={pingoAccentContinueButtonStyle(false)}>
          <span>{q.cta}</span>
        </button>
      </div>
    </>
  );
}
function renderHero(slide) {
  return (
    <>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
          paddingBottom: 8,
          minHeight: "100%",
        }}
      >
        <div style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 154,
            }}
          >
            <img
              src={fluentUpLogo}
              alt="FluentUp logo"
              style={{
                width: 196,
                height: 196,
                objectFit: "contain",
                display: "block",
                animation: "heroArrowFloat 2.6s ease-in-out infinite",
                transformOrigin: "center",
              }}
            />
          </div>

                   <div
            style={{
              marginTop: 18,
              textAlign: "center",
              minHeight: 62,
              fontSize: 34,
              lineHeight: 1.12,
              fontWeight: 700,
              color: "#111111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              letterSpacing: "-0.03em",
              fontFamily: HERO_FONT,
            }}
          >
            <span>{heroTypedText}</span>
            <span
              style={{
                display: "inline-block",
                width: 3,
                height: 34,
                borderRadius: 999,
                background: "#111111",
                opacity: heroCursorVisible ? 1 : 0,
                transition: "opacity 0.12s linear",
                transform: "translateY(1px)",
              }}
            />
          </div>

          <div style={{ marginTop: 130, textAlign: "center" }}>
                        <div
              style={{
                fontSize: 44,
                lineHeight: 1.02,
                fontWeight: 700,
                color: "#000000",
                letterSpacing: "-0.03em",
                fontFamily: HERO_FONT,
              }}
            >
              {slide.brandTitle}
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 16,
                lineHeight: 1.32,
                fontWeight: 500,
                color: "#111111",
                letterSpacing: "-0.015em",
                fontFamily: HERO_FONT,
              }}
            >
              {slide.subtitle}
            </div>
          </div>
        </div>

        <div
          style={{
            width: "100%",
            paddingTop: 0,
            marginTop: -36,
          }}
        >
          <button onClick={handleNext} style={pingoButtonStyle()}>
            <span>{slide.cta}</span>
          </button>


        </div>
      </div>
    </>
  );
}
function renderAccentFeature(slide) {
  const progressPercent = 14;

  return (
    <>
      <div style={{ marginTop: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={handleBack} style={pingoAccentBackButtonStyle()}>
            <ArrowLeft size={28} strokeWidth={2.6} />
          </button>

          <div
            style={{
              flex: 1,
              height: 24,
              background: "#D9D9D9",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "#1F1F1F",
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 34,
          fontSize: 34,
          lineHeight: 1.14,
          fontWeight: 700,
          color: "#000000",
          letterSpacing: "-0.04em",
          fontFamily: HERO_FONT,
          maxWidth: 360,
        }}
      >
        {slide.title}
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
        {slide.options.map((opt) => (
          <AccentOptionCard
            key={opt.value}
            emoji={opt.emoji}
            label={opt.label}
            selected={answers.accent === opt.value}
            onClick={async () => {
  await pulseOptionHaptic();
  setAnswers((prev) => ({ ...prev, accent: opt.value }));
}}
          />
        ))}
      </div>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <button
          onClick={handleNext}
          disabled={!answers.accent}
          style={pingoAccentContinueButtonStyle(!answers.accent)}
        >
          <span>{slide.cta}</span>
        </button>
      </div>
    </>
  );
}

function renderAccentLevelFeature(slide) {
  const progressPercent = 22;
  const accentLabel = answers.accent === "british" ? "British" : "American";

  return (
    <>
      <div style={{ marginTop: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={handleBack} style={pingoAccentBackButtonStyle()}>
            <ArrowLeft size={28} strokeWidth={2.6} />
          </button>

          <div
            style={{
              flex: 1,
              height: 24,
              background: "#D9D9D9",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "#1F1F1F",
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 34,
          fontSize: 34,
          lineHeight: 1.14,
          fontWeight: 700,
          color: "#000000",
          letterSpacing: "-0.04em",
          fontFamily: HERO_FONT,
          maxWidth: 380,
        }}
      >
        {`How good is your ${accentLabel} accent?`}
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
        {slide.options.map((opt) => (
          <AccentLevelCard
            key={opt.value}
            title={opt.title}
            subtitle={answers.accent === "british" ? opt.subtitleBritish : opt.subtitleAmerican}
            dots={opt.dots}
            selected={answers.accentLevel === opt.value}
            onClick={async () => {
  await pulseOptionHaptic();
  setAnswers((prev) => ({ ...prev, accentLevel: opt.value }));
}}
          />
        ))}
      </div>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <button
          onClick={handleNext}
          disabled={!answers.accentLevel}
          style={pingoAccentContinueButtonStyle(!answers.accentLevel)}
        >
          <span>{slide.cta}</span>
        </button>
      </div>
    </>
  );
}
function renderFeature(slide) {
  return (
    <>
      <div style={{ paddingTop: 10 }}>
        <PhoneMockup screenshot={slide.screenshot} />
      </div>

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.06, color: TEXT }}>{slide.title}</div>
        <div style={{ marginTop: 12, fontSize: 18, lineHeight: 1.55, color: MUTED }}>{slide.subtitle}</div>
        <FeatureDots items={slide.dots} />
{slide.title === "Pronunciation Feedback" && <div style={{ height: 40 }} />}
      </div>

         <div style={{ marginTop: slide.title === "Practice Real Conversations" ? 26 : 45 }}>
  <button onClick={handleNext} style={gradientButtonStyle(["#D980FA", "#FF6B81"])}>
    <span>{slide.cta}</span>
    <ArrowRight size={20} />
  </button>
</div>
    </>
  );
}
function renderGoalQuestionPingo(q) {
  const progressPercent = 25;

  return (
    <>
      <div style={{ marginTop: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={handleBack} style={pingoAccentBackButtonStyle()}>
            <ArrowLeft size={28} strokeWidth={2.6} />
          </button>

          <div
            style={{
              flex: 1,
              height: 24,
              background: "#D9D9D9",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "#1F1F1F",
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 34,
          fontSize: 34,
          lineHeight: 1.14,
          fontWeight: 700,
          color: "#000000",
          letterSpacing: "-0.04em",
          fontFamily: HERO_FONT,
          maxWidth: 360,
        }}
      >
        {q.title}
      </div>

      <div style={{ display: "grid", gap: 18, marginTop: 28 }}>
        {q.options.map((opt) => (
          <PingoGoalOptionButton
            key={opt.value}
            emoji={opt.emoji}
            label={opt.label}
            selected={answers[q.key] === opt.value}
            onClick={async () => {
  await pulseOptionHaptic();
  setAnswers((prev) => ({ ...prev, [q.key]: opt.value }));
}}
          />
        ))}
      </div>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <button
          onClick={handleNext}
          disabled={!answers[q.key]}
          style={pingoAccentContinueButtonStyle(!answers[q.key])}
        >
          <span>{q.cta}</span>
        </button>
      </div>
    </>
  );
}
function renderDailyGoalQuestionPingo(q) {
  const progressPercent = 50;

  return (
    <>
      <div style={{ marginTop: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={handleBack} style={pingoAccentBackButtonStyle()}>
            <ArrowLeft size={28} strokeWidth={2.6} />
          </button>

          <div
            style={{
              flex: 1,
              height: 24,
              background: "#D9D9D9",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "#1F1F1F",
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 34,
          fontSize: 34,
          lineHeight: 1.14,
          fontWeight: 700,
          color: "#000000",
          letterSpacing: "-0.04em",
          fontFamily: HERO_FONT,
          maxWidth: 340,
        }}
      >
        {q.title}
      </div>

      <div style={{ display: "grid", gap: 14, marginTop: 48 }}>
        {q.options.map((opt) => (
          <DailyGoalOptionCard
            key={opt.value}
            left={opt.left}
            right={opt.right}
            selected={answers[q.key] === opt.value}
            onClick={async () => {
              await pulseOptionHaptic();
              setAnswers((prev) => ({ ...prev, [q.key]: opt.value }));
            }}
          />
        ))}
      </div>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <button
          onClick={handleNext}
          disabled={!answers[q.key]}
          style={pingoAccentContinueButtonStyle(!answers[q.key])}
        >
          <span>{q.cta}</span>
        </button>
      </div>
    </>
  );
}
function renderQuestion(q, qIndex) {
  const progressPercent = ((qIndex + 1) / questions.length) * 100;

  return (
    <>
      <div style={{ position: "relative", marginTop: 48, marginBottom: 26, minHeight: 84 }}>
        <div style={{ position: "absolute", left: 0, top: 0 }}>
          <button onClick={handleBack} style={backButtonStyle()}>
            <ArrowLeft size={22} />
          </button>
        </div>

        <div style={{ marginLeft: 58, marginRight: 44, paddingTop: 20 }}>
          <ProgressBar value={progressPercent} />
          <div style={{ textAlign: "center", marginTop: 8, color: MUTED, fontWeight: 700, fontFamily: HERO_FONT }}>
            {q.progressLabel}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: -18 }}>
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: 999,
            margin: "0 auto 16px",
            background: "linear-gradient(180deg, rgba(106,90,224,1) 0%, rgba(33,150,243,1) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 30px rgba(33,150,243,0.25)",
          }}
        >
          {q.key === "goal" && <Target size={30} color="#fff" />}
          {q.key === "practiceStyle" && <AudioLines size={30} color="#fff" />}
          {q.key === "confidence" && <Sparkles size={30} color="#fff" />}
        </div>

        <div style={{ color: MUTED, fontWeight: 800, letterSpacing: "0.16em", fontSize: 12, fontFamily: HERO_FONT }}>
          {q.eyebrow}
        </div>

        <div
          style={{
            fontSize: 32,
            lineHeight: 1.05,
            fontWeight: 900,
            color: TEXT,
            marginTop: 10,
            fontFamily: HERO_FONT,
            letterSpacing: "-0.03em",
          }}
        >
          {q.title}
        </div>

        <div
          style={{
            fontSize: 16,
            lineHeight: 1.45,
            color: MUTED,
            marginTop: 10,
            fontFamily: HERO_FONT,
          }}
        >
          {q.subtitle}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 2 }}>
        {q.options.map((opt) => (
          <OptionButton
            key={opt.value}
            emoji={opt.emoji}
            label={opt.label}
            selected={answers[q.key] === opt.value}
            onClick={async () => {
  await pulseOptionHaptic();
  setAnswers((prev) => ({ ...prev, [q.key]: opt.value }));
}}
          />
        ))}
      </div>

      <div style={{ marginTop: "auto", paddingTop: 2 }}>
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
  const step1 = loadingPct >= 34 ? "done" : "active";
  const step2 = loadingPct >= 34 && loadingPct < 67 ? "active" : loadingPct >= 67 ? "done" : "idle";
  const step3 = loadingPct >= 67 && loadingPct < 100 ? "active" : loadingPct >= 100 ? "done" : "idle";

  return (
    <>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingBottom: 60,
        }}
      >
        <div style={{ marginTop: -26 }}>
          <LoadingCircle value={loadingPct} />
        </div>

        <div
          style={{
            marginTop: 34,
            textAlign: "center",
            fontSize: 38,
            lineHeight: 1.05,
            fontWeight: 700,
            color: "#000000",
            letterSpacing: "-0.05em",
            fontFamily: HERO_FONT,
          }}
        >
          Creating your learning
          <br />
          plan
        </div>

        <div
          style={{
            display: "grid",
            gap: 24,
            marginTop: 54,
            paddingLeft: 56,
          }}
        >
          <LoadingChecklistRow state={step1} text="Analyzing your goals" />
          <LoadingChecklistRow state={step2} text="Designing learning path" />
          <LoadingChecklistRow state={step3} text="Preparing conversations" />
        </div>
      </div>
    </>
  );
}

 function renderProjection() {
  return (
    <>
      <div style={{ marginTop: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={handleBack} style={pingoAccentBackButtonStyle()}>
            <ArrowLeft size={28} strokeWidth={2.6} />
          </button>

          <div
            style={{
              flex: 1,
              height: 24,
              background: "#D9D9D9",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "38%",
                height: "100%",
                background: "#1F1F1F",
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 34,
          fontSize: 34,
          lineHeight: 1.14,
          fontWeight: 700,
          color: "#000000",
          letterSpacing: "-0.04em",
          fontFamily: HERO_FONT,
          maxWidth: 360,
        }}
      >
        FluentUp builds real speaking confidence
      </div>

  <div style={{ marginTop: 48 }}>
  <ProjectionChart />
</div>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <button onClick={handleNext} style={pingoAccentContinueButtonStyle(false)}>
          <span>Continue</span>
        </button>
      </div>
    </>
  );
}
function renderSpeedCompareQuestionPingo(q) {
  const progressPercent = 50;

  return (
    <>
      <div style={{ marginTop: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={handleBack} style={pingoAccentBackButtonStyle()}>
            <ArrowLeft size={28} strokeWidth={2.6} />
          </button>

          <div
            style={{
              flex: 1,
              height: 24,
              background: "#D9D9D9",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
  style={{
    width: `${progressPercent}%`,
    height: "100%",
    background: "#1F1F1F",
    borderRadius: 999,
  }}
/>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 34,
          fontSize: 34,
          lineHeight: 1.14,
          fontWeight: 700,
          color: "#000000",
          letterSpacing: "-0.04em",
          fontFamily: HERO_FONT,
          maxWidth: 360,
        }}
      >
        {q.title}
      </div>

      <div style={{ marginTop: 48 }}>
        <SpeedCompareCard />
      </div>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <button onClick={handleNext} style={pingoAccentContinueButtonStyle(false)}>
          <span>{q.cta}</span>
        </button>
      </div>
    </>
  );
}
function renderThreeMonthsQuestionPingo(q) {
  const progressPercent = 75;

  return (
    <>
      <div style={{ marginTop: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={handleBack} style={pingoAccentBackButtonStyle()}>
            <ArrowLeft size={28} strokeWidth={2.6} />
          </button>

          <div
            style={{
              flex: 1,
              height: 24,
              background: "#D9D9D9",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "#1F1F1F",
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 34,
          fontSize: 34,
          lineHeight: 1.12,
          fontWeight: 700,
          color: "#000000",
          letterSpacing: "-0.045em",
          fontFamily: HERO_FONT,
          maxWidth: 370,
        }}
      >
        {q.title}
      </div>

      <div style={{ marginTop: 26 }}>
        <ThreeMonthsCard />
      </div>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <button onClick={handleNext} style={pingoAccentContinueButtonStyle(false)}>
          <span>{q.cta}</span>
        </button>
      </div>
    </>
  );
}
function RatingMiniAvatar({ src }) {
  return (
    <img
      src={src}
      alt=""
      style={{
        width: 42,
        height: 42,
        borderRadius: 999,
        objectFit: "cover",
        display: "block",
        border: "2px solid #F3F3F3",
        flexShrink: 0,
      }}
    />
  );
}
function LaurelSide({ mirrored = false }) {
  return (
    <svg
      width="34"
      height="54"
      viewBox="0 0 34 54"
      style={{
        display: "block",
        transform: mirrored ? "scaleX(-1)" : "none",
      }}
    >
      <ellipse cx="23" cy="10" rx="6.5" ry="10" transform="rotate(-28 23 10)" fill="#111111" />
      <ellipse cx="15" cy="21" rx="6.5" ry="10" transform="rotate(-52 15 21)" fill="#111111" />
      <ellipse cx="11" cy="35" rx="6.5" ry="10" transform="rotate(-74 11 35)" fill="#111111" />
      <ellipse cx="18" cy="47" rx="6.5" ry="10" transform="rotate(-92 18 47)" fill="#111111" />
    </svg>
  );
}
function GoldStars({ size = 38, gap = 10 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap,
      }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          fill="#F5C400"
          color="#F5C400"
          strokeWidth={1.6}
        />
      ))}
    </div>
  );
}
function RatingReviewCard({ image, name, text }) {
  return (
    <div
      style={{
        background: "#EAEAEA",
        borderRadius: 30,
        padding: "18px 18px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
<RatingMiniAvatar src={image} />
          <div
            style={{
              fontSize: 22,
              lineHeight: 1.05,
              fontWeight: 700,
              color: "#111111",
              letterSpacing: "-0.03em",
              fontFamily: HERO_FONT,
            }}
          >
            {name}
          </div>
        </div>

       <GoldStars size={22} gap={4} />
      </div>

      <div
        style={{
          marginTop: 14,
          fontSize: 16,
          lineHeight: 1.28,
          fontWeight: 500,
          color: "#111111",
          letterSpacing: "-0.02em",
          fontFamily: HERO_FONT,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function renderRatingPromptQuestionPingo(q) {
  const progressPercent = 88;

  return (
    <>
      <div style={{ marginTop: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={handleBack} style={pingoAccentBackButtonStyle()}>
            <ArrowLeft size={28} strokeWidth={2.6} />
          </button>

          <div
            style={{
              flex: 1,
              height: 24,
              background: "#D9D9D9",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "#1F1F1F",
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 34,
          fontSize: 34,
          lineHeight: 1.12,
          fontWeight: 700,
          color: "#000000",
          letterSpacing: "-0.045em",
          fontFamily: HERO_FONT,
          maxWidth: 370,
        }}
      >
        {q.title}
      </div>

      <div style={{ marginTop: 30, textAlign: "center" }}>
       <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  }}
>
  <LaurelSide />
  <GoldStars size={40} gap={10} />
  <LaurelSide mirrored />
</div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
          }}
        >
         <RatingMiniAvatar src={review1Img} />
<div style={{ marginLeft: -8 }}>
  <RatingMiniAvatar src={review2Img} />
</div>
<div style={{ marginLeft: -8 }}>
  <RatingMiniAvatar src={review3Img} />
</div>

          <div
            style={{
              marginLeft: 12,
              fontSize: 18,
              lineHeight: 1.1,
              fontWeight: 500,
              color: "#111111",
              letterSpacing: "-0.03em",
              fontFamily: HERO_FONT,
            }}
          >
            +500,000 learners
          </div>
        </div>
      </div>

  <div style={{ display: "grid", gap: 18, marginTop: 24, paddingBottom: 8 }}>
<RatingReviewCard
  image={review1Img}
  name="Sofia Petrova"
  text="This app improved my pronunciation faster than practicing alone. The instant feedback and repetition made a huge difference."
/>

<RatingReviewCard
  image={review2Img}
  name="Omar Haddad"
  text="I feel much more confident speaking now. It feels practical, clear, and easy to use every day."
/>

<RatingReviewCard
  image={review3Img}
  name="Camila Rojas"
  text="The feedback is super clear and it actually helped me sound more natural in real conversations."
/>
</div>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <button onClick={handleNext} style={pingoAccentContinueButtonStyle(false)}>
          <span>{q.cta}</span>
        </button>
      </div>
    </>
  );
}

  function renderFinal() {
    return (
      <>
        <div style={{ textAlign: "center", paddingTop: 62 }}>
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
    if (slide.type === "accent") return renderAccentFeature(slide);
    if (slide.type === "accentLevel") return renderAccentLevelFeature(slide);
    return renderFeature(slide);
  }

  if (index >= featureSlides.length && index < featureSlides.length + questions.length) {
    const qIndex = index - featureSlides.length;
    const q = questions[qIndex];
  if (q.key === "goal") return renderGoalQuestionPingo(q);
if (q.key === "speedCompare") return renderSpeedCompareQuestionPingo(q);
if (q.key === "threeMonths") return renderThreeMonthsQuestionPingo(q);
if (q.key === "ratingPrompt") return renderRatingPromptQuestionPingo(q);
if (q.key === "dailyGoal") return renderDailyGoalQuestionPingo(q);
if (q.key === "notificationPrompt") return renderNotificationPromptQuestionPingo(q);
    return renderQuestion(q, qIndex);
  }

  if (index === projectionIndex) return renderProjection();
  if (index === loadingIndex) return renderLoading();
  return renderFinal();
}

return (
  <div
    style={{
      position: "fixed",
      inset: 0,
      width: "100vw",
      height: "100dvh",
      background: BG,
      color: TEXT,
      display: "flex",
      justifyContent: "center",
      overflow: "hidden",
      overscrollBehavior: "none",
    }}
  >
        <style>{heroArrowKeyframes}</style>
    <div
  ref={scrollRef}
  style={{
    width: "100%",
    maxWidth: 520,
    height: "100%",
    minHeight: 0,
    paddingTop: 22,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: "calc(26px + env(safe-area-inset-bottom, 0px))",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    overflowX: "hidden",
    overscrollBehaviorY: "contain",
    WebkitOverflowScrolling: "touch",
    background: BG,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
  }}
>
  {renderStep()}
</div>
  </div>
);
}
const heroArrowKeyframes = `
@keyframes heroArrowFloat {
  0% { transform: translateY(0px) rotate(-0.6deg); }
  50% { transform: translateY(-2px) rotate(0.6deg); }
  100% { transform: translateY(0px) rotate(-0.6deg); }
}

@keyframes miniSpinnerRotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes fingerFloat {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}
`;
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
    height: 74,
    borderRadius: 999,
    border: "none",
    background: disabled ? "#BFC8F3" : BLUE,
    color: disabled ? "#F5F1E8" : "#F5EEDC",
    fontSize: 26,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: 1,
    boxShadow: "none",
    fontFamily: HERO_FONT,
    letterSpacing: "-0.02em",
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
function pingoButtonStyle() {
  return {
    width: "100%",
    height: 74,
    borderRadius: 999,
    border: "none",
    background: BLUE,
    color: "#F5EEDC",
    fontSize: 26,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "none",
    fontFamily: HERO_FONT,
    letterSpacing: "-0.02em",
  };
}
function pingoAccentBackButtonStyle() {
  return {
    width: 52,
    height: 52,
    borderRadius: 999,
    border: "none",
    background: "transparent",
    color: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  };
}

function pingoAccentContinueButtonStyle(disabled = false) {
  return {
    width: "100%",
    height: 74,
    borderRadius: 999,
    border: "none",
    background: disabled ? "#BFC8F3" : BLUE,
    color: disabled ? "#F5F1E8" : "#F5EEDC",
    fontSize: 26,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: 1,
    boxShadow: "none",
    fontFamily: HERO_FONT,
    letterSpacing: "-0.02em",
    transition: "background 160ms ease, box-shadow 160ms ease, transform 160ms ease",
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