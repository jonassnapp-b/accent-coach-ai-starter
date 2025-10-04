import React, { useEffect, useRef, useState } from "react";

const SAMPLE_URL = "/samples/en-US/quick_brown_fox.mp3";
const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || window.location.origin;

export default function App() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [targetPhrase, setTargetPhrase] = useState(
    "The quick brown fox jumps over the lazy dog."
  );
  const [targetAccent, setTargetAccent] = useState("American");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("record");

  // compare tab audio refs
  const sampleAudioRef = useRef(null);
  const userAudioRef = useRef(null);
  const [mix, setMix] = useState(50);

  // start recording
  async function startRecording() {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioURL(URL.createObjectURL(blob));
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      setError("Microphone not accessible.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function analyzeAudio() {
    if (!audioURL) return;
    setBusy(true);
    try {
      const blob = await fetch(audioURL).then((r) => r.blob());
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("targetPhrase", targetPhrase);
      formData.append("targetAccent", targetAccent);

      const res = await fetch(`${API_BASE}/api/score`, { method: "POST", body: formData });
      const data = await res.json();
      setScore(data);
      setFeedback(data.feedback || null);
    } catch (err) {
      setError("Failed to analyze audio.");
    } finally {
      setBusy(false);
    }
  }

  // --- Render UI ---
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", margin: "40px auto", width: 700 }}>
      <h1>Accent Coach AI</h1>

      {/* Tabs */}
      <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
        <button
          style={activeTab === "record" ? styles.tabBtnActive : styles.tabBtnPassive}
          onClick={() => setActiveTab("record")}
        >
          🎤 Record
        </button>
        <button
          style={activeTab === "compare" ? styles.tabBtnActive : styles.tabBtnPassive}
          onClick={() => setActiveTab("compare")}
        >
          🎚️ Compare
        </button>
      </div>

      {activeTab === "record" && (
        <div>
          <label>Target phrase</label>
          <textarea
            value={targetPhrase}
            onChange={(e) => setTargetPhrase(e.target.value)}
            rows={2}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <label>Target accent</label>
          <select
            value={targetAccent}
            onChange={(e) => setTargetAccent(e.target.value)}
            style={{ width: "100%", marginBottom: 20 }}
          >
            <option>American</option>
            <option>British</option>
            <option>Australian</option>
          </select>

          <div style={{ display: "flex", gap: 10 }}>
            {!recording ? (
              <button style={styles.primaryBtn} onClick={startRecording}>
                🎙️ Start recording
              </button>
            ) : (
              <button style={styles.dangerBtn} onClick={stopRecording}>
                ⏹️ Stop
              </button>
            )}
            <button
              style={styles.grayBtn}
              onClick={analyzeAudio}
              disabled={!audioURL || busy}
            >
              🔍 Analyze
            </button>
          </div>

          {audioURL && (
            <div style={{ marginTop: 20 }}>
              <audio controls src={audioURL}></audio>
            </div>
          )}

          {score && (
            <div style={{ marginTop: 20, lineHeight: 1.6 }}>
              <h3>Score: {score.overall}/100</h3>
              {feedback && (
                <>
                  <p>{feedback.overall}</p>
                  <ul>
                    {feedback.focusAreas?.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "compare" && (
        <div style={{ marginTop: 20 }}>
          <h3>Compare pronunciation</h3>
          <audio ref={sampleAudioRef} src={SAMPLE_URL} controls />
          <br />
          {audioURL ? (
            <audio ref={userAudioRef} src={audioURL} controls />
          ) : (
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
              (No recording yet — you can still listen to the native sample.)
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <label>Blend (0 = Native, 100 = You): {mix}</label>
            <input
              type="range"
              min="0"
              max="100"
              value={mix}
              onChange={(e) => setMix(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      )}

      {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}

      <div style={{ marginTop: 30, fontSize: 12, opacity: 0.6 }}>
        API: {API_BASE}/api/score
      </div>
    </div>
  );
}

const styles = {
  primaryBtn: {
    background: "#007bff",
    color: "white",
    border: "none",
    padding: "8px 14px",
    borderRadius: 6,
    cursor: "pointer",
  },
  dangerBtn: {
    background: "#dc3545",
    color: "white",
    border: "none",
    padding: "8px 14px",
    borderRadius: 6,
    cursor: "pointer",
  },
  grayBtn: {
    background: "#6c757d",
    color: "white",
    border: "none",
    padding: "8px 14px",
    borderRadius: 6,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "#000",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: 20,
    cursor: "pointer",
  },
  tabBtnPassive: {
    background: "#e0e0e0",
    color: "#333",
    border: "none",
    padding: "8px 12px",
    borderRadius: 20,
    cursor: "pointer",
  },
};
