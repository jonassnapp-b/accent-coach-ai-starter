// frontend/src/tabs/CoachTab.jsx
import React, { useState } from "react";

export default function CoachTab() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Tell me which words are hard and I’ll coach you." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function send() {
    if (!input.trim()) return;
    const next = [...messages, { role: "user", content: input.trim() }];
    setMessages(next);
    setInput("");
    try {
      setErr(null);
      setBusy(true);
      const res = await api.chat(next);
      setMessages([...next, { role: "assistant", content: res.reply || "(no reply)" }]);
    } catch (e) {
      setErr("Chat failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.card}>
      <h3>AI Coach</h3>
      <p style={{ marginTop: -6, color: "#667085" }}>
        Ask why something is mispronounced — and how to fix it.
      </p>

      <div style={styles.chatBox}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === "assistant" ? styles.assistant : styles.user}>
            {m.content}
          </div>
        ))}
      </div>

      {err && <div style={styles.error}>{err}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
          style={styles.input}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button style={styles.primaryBtn} onClick={send} disabled={busy}>
          {busy ? "Thinking…" : "Send"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: { background: "#fff", border: "1px solid #EAECF0", borderRadius: 12, padding: 16 },
  chatBox: {
    border: "1px solid #EAECF0",
    borderRadius: 8,
    padding: 12,
    minHeight: 180,
    marginBottom: 12,
    background: "#FBFCFD",
  },
  assistant: { padding: "8px 10px", background: "#EEF2FF", borderRadius: 8, margin: "6px 0" },
  user: { padding: "8px 10px", background: "#ECFDF3", borderRadius: 8, margin: "6px 0" },
  input: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #D0D5DD",
    fontSize: 13,
  },
  primaryBtn: {
    background: "#1D4ED8",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
  },
  error: {
    marginBottom: 10,
    background: "#FEF2F2",
    border: "1px solid #FCA5A5",
    color: "#B91C1C",
    padding: 10,
    borderRadius: 8,
  },
};
