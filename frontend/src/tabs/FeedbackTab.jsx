// frontend/src/tabs/FeedbackTab.jsx
import React, { useState } from "react";
import { api } from "../lib/api";

export default function FeedbackTab() {
  const [phrase, setPhrase] = useState("The quick brown fox jumps over the lazy dog.");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  async function run() {
    try {
      setErr(null);
      setLoading(true);
      const res = await api.feedback(phrase);
      setData(res);
    } catch (e) {
      setErr("Could not get feedback.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <h3>Smart feedback</h3>
      <p style={{ marginTop: -6, color: "#667085" }}>
        Get phoneme-level tips and specific focus areas to improve faster.
      </p>

      <textarea
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        style={styles.textarea}
        rows={3}
      />

      <button style={styles.primaryBtn} onClick={run} disabled={loading}>
        {loading ? "Analyzing…" : "Analyze"}
      </button>

      {err && <div style={styles.error}>{err}</div>}

      {data && (
        <div style={{ marginTop: 16 }}>
          <div style={styles.box}>
            <strong>Overall:</strong>
            <div style={{ marginTop: 6 }}>{data.feedback?.overall || "—"}</div>
          </div>

          {!!(data.feedback?.focusAreas || []).length && (
            <div style={styles.box}>
              <strong>Focus areas</strong>
              <ul style={{ margin: "8px 0 0 16px" }}>
                {data.feedback.focusAreas.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {!!(data.feedback?.wordTips || []).length && (
            <div style={styles.box}>
              <strong>Word tips</strong>
              <ul style={{ margin: "8px 0 0 16px" }}>
                {data.feedback.wordTips.map((t, i) => (
                  <li key={i}>
                    <code>{t.word}</code> — {t.note}
                    {t.drill ? <div style={{ color: "#667085" }}>{t.drill}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!!(data.feedback?.nextSteps || []).length && (
            <div style={styles.box}>
              <strong>Next steps</strong>
              <ul style={{ margin: "8px 0 0 16px" }}>
                {data.feedback.nextSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: { background: "#fff", border: "1px solid #EAECF0", borderRadius: 12, padding: 16 },
  textarea: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #D0D5DD",
    margin: "8px 0 12px",
    fontSize: 14,
  },
  primaryBtn: {
    background: "#1D4ED8",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
  },
  box: { border: "1px solid #EAECF0", borderRadius: 8, padding: 12, marginTop: 12 },
  error: {
    marginTop: 12,
    background: "#FEF2F2",
    border: "1px solid #FCA5A5",
    color: "#B91C1C",
    padding: 10,
    borderRadius: 8,
  },
};
