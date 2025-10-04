import React, { useEffect, useRef, useState } from "react";

// Native sample audio (used for A/B comparison)
const SAMPLE_URL = "/samples/en-US/quick_brown_fox.mp3";


const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || window.location.origin;

export default function App() {
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

  // result payload from API
  const [score, setScore] = useState(null);      // { overall, words: [{word,score}, ...] }
  const [feedback, setFeedback] = useState(null); // { overall, focusAreas, wordTips, nextSteps }

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

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      setError(e?.message || "Could not start recording");
    }
  }

  function stopRecording() {
    try {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current?.stream
        ?.getTracks()
        ?.forEach((t) => t.stop());
    } catch {
      // ignore
    } finally {
      setRecording(false);
    }
  }

  async function analyzePronunciation() {
    if (!audioURL) {
      setError("Please record first.");
      return;
    }
    setBusy(true);
    setError(null);
    setScore(null);
    setFeedback(null);

    try {
      // turn the preview blob URL back into a Blob we can send
      const resBlob = await fetch(audioURL).then((r) => r.blob());
      const form = new FormData();
      form.append("audio", resBlob, "sample.webm");
      form.append("targetPhrase", targetPhrase);
      form.append("targetAccent", targetAccent);

      const res = await fetch(`${API_BASE}/api/score`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API error: ${res.status} – ${txt}`);
      }

      const data = await res.json();
      setScore(data || null);
      setFeedback(data?.feedback || null);
    } catch (e) {
      setError(e?.message || "Failed to fetch");
    } finally {
      setBusy(false);
    }
  }

  const ScoreBar = ({ value = 0 }) => (
    <div style={{ width: "100%", background: "#eee", borderRadius: 6 }}>
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: value >= 80 ? "#22c55e" : value >= 60 ? "#f59e0b" : "#ef4444",
          height: 8,
          borderRadius: 6,
          transition: "width .3s ease",
        }}
      />
    </div>
  );

  return (
    <div style={{ maxWidth: 880, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ marginBottom: 8 }}>Accent Coach AI <span style={{ fontSize: 14, color: "#888" }}>MVP</span></h1>
      <p style={{ color: "#555" }}>
        Record your voice, compare it against a target phrase, and get a score + actionable tips.
      </p>

      {/* Controls */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}
      >
        <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
          Target phrase
        </label>
        <textarea
          value={targetPhrase}
          onChange={(e) => setTargetPhrase(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            resize: "vertical",
          }}
        />

        <div style={{ height: 12 }} />

        <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
          Target accent
        </label>
        <select
          value={targetAccent}
          onChange={(e) => setTargetAccent(e.target.value)}
          style={{
            padding: 10,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            minWidth: 220,
          }}
        >
          <option>American</option>
          <option>British</option>
          <option>Australian</option>
          <option>General English</option>
        </select>

        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          {!recording ? (
            <button
              onClick={startRecording}
              style={{
                padding: "10px 14px",
                background: "#111827",
                color: "#fff",
                borderRadius: 8,
                border: "none",
              }}
            >
              ● Start recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              style={{
                padding: "10px 14px",
                background: "#ef4444",
                color: "#fff",
                borderRadius: 8,
                border: "none",
              }}
            >
              ■ Stop
            </button>
          )}

          <button
            onClick={analyzePronunciation}
            disabled={!audioURL || busy}
            style={{
              padding: "10px 14px",
              background: busy ? "#9ca3af" : "#7c3aed",
              color: "#fff",
              borderRadius: 8,
              border: "none",
              opacity: !audioURL ? 0.7 : 1,
            }}
          >
            {busy ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        {audioURL && (
          <>
            <div style={{ height: 12 }} />
            <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
              Preview of your recording
            </label>
            <audio src={audioURL} controls style={{ width: "100%" }} />
          </>
        )}

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: 8,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {(score || feedback) && (
        <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
          {/* Overall score & per-word scores */}
          {score && (
            <div
              style={{
                padding: 16,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Score</h2>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  marginBottom: 8,
                }}
              >
                {score.overall ?? "–"}/100
              </div>

              {Array.isArray(score.words) && score.words.length > 0 && (
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {score.words.map((w, idx) => (
                    <div key={idx}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{w.word}</div>
                        <div style={{ minWidth: 52, textAlign: "right" }}>
                          {w.score}/100
                        </div>
                      </div>
                      <ScoreBar value={w.score} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feedback block */}
          {feedback && (
            <div
              style={{
                padding: 16,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
              }}
            >
              <h2 style={{ marginTop: 0 }}>How to improve</h2>

              {feedback.overall && (
                <p style={{ marginTop: 8 }}>{feedback.overall}</p>
              )}

              {Array.isArray(feedback.focusAreas) &&
                feedback.focusAreas.length > 0 && (
                  <>
                    <h3 style={{ marginBottom: 6 }}>Focus areas</h3>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {feedback.focusAreas.map((f, i) => (
                        <span
                          key={i}
                          style={{
                            background: "#eef2ff",
                            color: "#3730a3",
                            border: "1px solid #c7d2fe",
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                          }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </>
                )}

              {Array.isArray(feedback.wordTips) &&
                feedback.wordTips.length > 0 && (
                  <>
                    <h3 style={{ marginBottom: 6, marginTop: 16 }}>
                      Word-level tips
                    </h3>
                    <div style={{ display: "grid", gap: 10 }}>
                      {feedback.wordTips.map((t, i) => (
                        <div
                          key={i}
                          style={{
                            padding: 12,
                            border: "1px solid #e5e7eb",
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{t.word}</div>
                          {t.note && (
                            <div style={{ color: "#374151", marginTop: 6 }}>
                              {t.note}
                            </div>
                          )}
                          {t.drill && (
                            <div
                              style={{
                                marginTop: 8,
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                                background: "#f9fafb",
                                border: "1px dashed #e5e7eb",
                                padding: 8,
                                borderRadius: 8,
                              }}
                            >
                              {t.drill}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

              {Array.isArray(feedback.nextSteps) &&
                feedback.nextSteps.length > 0 && (
                  <>
                    <h3 style={{ marginBottom: 6, marginTop: 16 }}>
                      Next steps
                    </h3>
                    <ul style={{ marginTop: 6 }}>
                      {feedback.nextSteps.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
