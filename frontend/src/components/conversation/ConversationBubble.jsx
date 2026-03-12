// src/components/conversation/ConversationBubble.jsx

import React from "react";

export default function ConversationBubble({
  role,
  text,
  subtext,
}) {
  const isAssistant = role === "assistant";
  const isCoach = role === "coach";

  let bg = "#F3F4F6";
  let color = "#111827";
  let align = "flex-start";

  if (isAssistant) {
    bg = "#E8F1FF";
    color = "#0F172A";
    align = "flex-start";
  }

  if (role === "user") {
    bg = "#2196F3";
    color = "#FFFFFF";
    align = "flex-end";
  }

  if (isCoach) {
    bg = "#FFF4E5";
    color = "#7C4A00";
    align = "flex-start";
  }

  return (
    <div style={{ display: "flex", justifyContent: align, width: "100%" }}>
      <div
        style={{
          maxWidth: "82%",
          padding: "12px 14px",
          borderRadius: 18,
          background: bg,
          color,
          fontSize: 15,
          lineHeight: 1.45,
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <div>{text}</div>
        {subtext ? (
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              opacity: 0.75,
            }}
          >
            {subtext}
          </div>
        ) : null}
      </div>
    </div>
  );
}