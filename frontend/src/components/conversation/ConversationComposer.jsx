// src/components/conversation/ConversationComposer.jsx

import React from "react";

export default function ConversationComposer({
  isRecording,
  isBusy,
  onStartRecording,
  onStopRecording,
}) {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        background: "#FFFFFF",
        borderTop: "1px solid rgba(15,23,42,0.08)",
        padding: "12px 16px 18px",
      }}
    >
      <button
        onClick={isRecording ? onStopRecording : onStartRecording}
        disabled={isBusy}
        style={{
          width: "100%",
          border: "none",
          borderRadius: 16,
          padding: "16px 18px",
          background: isRecording ? "#FF9800" : "#2196F3",
          color: "#fff",
          fontWeight: 700,
          fontSize: 16,
          cursor: isBusy ? "not-allowed" : "pointer",
          opacity: isBusy ? 0.65 : 1,
        }}
      >
        {isBusy
          ? "Processing..."
          : isRecording
          ? "Stop recording"
          : "Tap to answer"}
      </button>
    </div>
  );
}