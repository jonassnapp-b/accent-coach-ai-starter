// frontend/src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import FeedbackTab from "./tabs/FeedbackTab.jsx";
import ProgressTab from "./tabs/ProgressTab.jsx";
import SocialTab from "./tabs/SocialTab.jsx";
import CoachTab from "./tabs/CoachTab.jsx";
import { API_BASE } from "./lib/api";

// ------- UI helpers -------
const styles = {
  shell: { maxWidth: 960, margin: "36px auto", padding: "0 16px" },
  h1: { fontSize: 36, fontWeight: 800 },
  card: { background: "#fff", border: "1px solid #EAECF0", borderRadius: 12, padding: 16 },
  label: { fontWeight: 600, marginBottom: 6, display: "block" },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #D0D5DD",
    fontSize: 14,
  },
  textarea: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #D0D5DD",
    margin: "8px 0 12px",
    fontSize: 14,
  },
  row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  primaryBtn: {
    background: "#1D4ED8",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
  },
  dangerBtn: {
    background: "#DC2626",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
  },
  grayBtn: {
    background: "#F2F4F7",
    color: "#111827",
    border: "1px solid #E5E7EB",
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
  },
  tabsBar: { display: "flex", gap: 8, marginTop: 16, marginBottom: 16, flexWrap: "wrap" },
  tabBtn: (active) => ({
    background: active ? "#111827" : "#F2F4F7",
    color: active ? "#fff" : "#111827",
    border: active ? "1px solid #111827" : "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
  }),
  apiNote: { marginTop: 24, color: "#667085", fontSize: 13 },
  error: {
    marginTop: 12,
    background: "#FEF2F2",
    border: "1px solid #FCA5A5",
    color: "#B91C1C",
    padding: 10,
    borderRadius: 8,
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState("record");

  // ------- Recording state (Record tab) -------
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [targetPhrase, setTargetPhrase] = useState(
    "The quick brown fox jumps over the lazy dog."
  );
  const [targetAccent, setTargetAccent] = useState("American");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    return () => {
      if (audioURL) URL.revokeObjectURL(audioURL);
    };
  }, [audioURL]);

  async function startRecording() {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioURL((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      setError("Microphone error. Check permissions.");
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }

  async function analyzeAudio() {
    if (!audioURL) return;
    try {
      setBusy(true);
      setError(null);

      const resp = await fetch(audioURL);
      const audioBlob = await resp.blob();

      const form = new FormData();
      form.append("audio", audioBlob, "sample.webm");
      form.append("targetPhrase", targetPhrase);
      form.append("targetAccent", targetAccent);

      const res = await fetch(`${API_BASE}/api/score`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setScore(data);
      setFeedback(data.feedback || null);
    } catch (e) {
      setError("API error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.shell}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={styles.h1}>Accent Coach AI</h1>
        <div style={{ color: "#667085" }}>MVP</div>
      </div>

      {/* Tabs */}
      <div style={styles.tabsBar}>
        {["record", "feedback", "progress", "social", "coach"].map((t) => (
          <button key={t} style={styles.tabBtn(activeTab === t)} onClick={() => setActiveTab(t)}>
            {t === "record" && <>🎤 Record</>}
            {t === "feedback" && <>🧠 Feedback</>}
            {t === "progress" && <>📈 Progress</>}
            {t === "social" && <>👥 Social</>}
            {t === "coach" && <>🤖 Coach</>}
          </button>
        ))}
      </div>

      {/* RECORD TAB */}
      {activeTab === "record" && (
        <div style={styles.card}>
          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>Target phrase</label>
            <textarea
              value={targetPhrase}
              onChange={(e) => setTargetPhrase(e.target.value)}
              style={styles.textarea}
              rows={3}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>Target accent</label>
            <select
              value={targetAccent}
              onChange={(e) => setTargetAccent(e.target.value)}
              style={styles.input}
            >
              <option>American</option>
              <option>British</option>
              <option>Australian</option>
            </select>
          </div>

          <div className="row" style={styles.row}>
            {!recording ? (
              <button style={styles.primaryBtn} onClick={startRecording}>
                Start recording
              </button>
            ) : (
              <button style={styles.dangerBtn} onClick={stopRecording}>
                Stop
              </button>
            )}

            <button
              style={styles.grayBtn}
              onClick={analyzeAudio}
              disabled={!audioURL || busy}
              title={!audioURL ? "Record something first" : "Analyze pronunciation"}
            >
              Analyze
            </button>
          </div>

          {audioURL && (
            <div style={{ marginTop: 12 }}>
              <audio src={audioURL} controls />
            </div>
          )}

          {error && <div style={styles.error}>{error}</div>}

          {score && (
            <div style={{ marginTop: 16 }}>
              <div style={{ border: "1px solid #EAECF0", borderRadius: 8, padding: 12 }}>
                <strong>Score:</strong> {score.overall}/100
                {!!(score.words || []).length && (
                  <ul style={{ margin: "8px 0 0 16px" }}>
                    {score.words.map((w, i) => (
                      <li key={i}>
                        <code>{w.word}</code> — {w.score}/100
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {feedback && (
                <div
                  style={{
                    border: "1px solid #EAECF0",
                    borderRadius: 8,
                    padding: 12,
                    marginTop: 12,
                  }}
                >
                  <strong>Smart feedback</strong>
                  <div style={{ marginTop: 6 }}>{feedback.overall}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FEEDBACK TAB */}
      {activeTab === "feedback" && <FeedbackTab />}

      {/* PROGRESS TAB */}
      {activeTab === "progress" && <ProgressTab userId="demo-user" />}

      {/* SOCIAL TAB */}
      {activeTab === "social" && <SocialTab />}

      {/* COACH TAB */}
      {activeTab === "coach" && <CoachTab />}

      <div style={styles.apiNote}>
        API: <code>{API_BASE}</code>
      </div>
    </div>
  );
}
