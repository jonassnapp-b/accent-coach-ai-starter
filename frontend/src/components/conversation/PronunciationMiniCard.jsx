// src/components/conversation/PronunciationMiniCard.jsx

import React from "react";

function scoreColor(score) {
  if (score >= 85) return "#16A34A";
  if (score >= 70) return "#F59E0B";
  return "#DC2626";
}

export default function PronunciationMiniCard({
  weakPhonemes = [],
  weakWords = [],
  suggestedRepeat = "",
}) {
  if (!weakPhonemes.length && !weakWords.length && !suggestedRepeat) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 16,
        background: "#F8FAFC",
        border: "1px solid rgba(15,23,42,0.08)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
        Pronunciation focus
      </div>

      {weakPhonemes.length ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
            Weak phonemes
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {weakPhonemes.map((p) => (
              <span
                key={`${p.label}-${p.score}`}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#fff",
                  border: "1px solid rgba(15,23,42,0.08)",
                  color: scoreColor(p.score),
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {p.label} · {p.score}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {weakWords.length ? (
        <div style={{ marginBottom: suggestedRepeat ? 8 : 0 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
            Weak words
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {weakWords.map((w) => (
              <span
                key={`${w.word}-${w.score}`}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#fff",
                  border: "1px solid rgba(15,23,42,0.08)",
                  color: scoreColor(w.score),
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {w.word} · {w.score}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {suggestedRepeat ? (
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          Try again: {suggestedRepeat}
        </div>
      ) : null}
    </div>
  );
}