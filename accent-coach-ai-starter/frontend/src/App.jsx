import React, { useEffect, useRef, useState } from "react";

// Native sample audio (used for A/B comparison)
// Make sure this file exists in: frontend/public/samples/en-US/quick_brown_fox.mp3
const SAMPLE_URL = "/samples/en-US/quick_brown_fox.mp3";

// Backend base URL
const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || window.location.origin;

/** Simple button styles (to keep colors consistent) */
const styles = {
  primaryBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  dangerBtn: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  grayBtn: {
    background: "#f3f4f6",
    color: "#111827",
    border: "1px solid #e5e7eb",
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  tabBtn: (active) => ({
    background: active ? "#111827" : "#f3f4f6",
    color: active ? "#fff" : "#111827",
    border: "1px solid #e5e7eb",
    padding: "8px 12px",
    borderRadius: 9999,
    cursor: "pointer",
    fontWeight: 600,
  }),
  card: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 },
};

export default function App() {
  /** -------- Tabs -------- */
  const [tab, setTab] = useState("practice"); // "practice" | "compare"

  /** -------- Recording state -------- */
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);

  /** -------- Compare (A/B) refs & state -------- */
  const sampleAudioRef = useRef(null);
  const userAudioRef = useRef(null);
  const [mix, setMix] = useState(50); // 0 = native only, 100 = you only
  const [comparing, setComparing] = useState(false);

  /** -------- Inputs -------- */
  const [targetPhrase, setTargetPhrase] = useState(
    "The quick brown fox jumps over the lazy dog."
  );
  const [targetAccent, setTargetAccent] = useState("American");

  /** -------- API/UI -------- */
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState(null);

  /** -------- Apply mix between sample + user -------- */
  const applyMix = (m) => {
    const user = userAudioRef.current;
    const sample = sampleAudioRef.current;
    if (!user || !sample) return;

    const u = Math.min(Math.max(m, 0), 100) / 100;
    user.volume = u;      // more of you
    sample.volume = 1 - u; // more native
  };

  useEffect(() => {
    applyMix(mix);
  }, [mix, audioURL]);

  /** -------- Recording -------- */
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
      setError("Microphone access failed");
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setRecording(false);
  }

  /** -------- Analyze (send to backend) -------- */
  async function analyzeAudio() {
    if (!audioURL) return;
    setBusy(true);
    setError(null);
    setScore(null);
    setFeedback(null);
    try {
      const blob = await fetch(audioURL).then((r) => r.blob());
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("targetPhrase", targetPhrase);
      formData.append("targetAccent", targetAccent);

      const res = await fetch(`${API_BASE}/api/score`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setScore(data.overall);
      setFeedback(data.feedback || null);
    } catch (err) {
      setError("Analysis failed: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  /** -------- Helper: load an <audio> and wait for canplaythrough -------- */
  const loadAndReady = (audioEl) =>
    new Promise((resolve, reject) => {
      if (!audioEl) return reject(new Error("No audio element"));
      const cleanup = () => {
        audioEl.removeEventListener("canplaythrough", onReady);
        audioEl.removeEventListener("error", onErr);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onErr = (e) => {
        cleanup();
        reject(e?.error || new Error("Audio failed to load"));
      };
      // Reset & load fresh
      audioEl.pause();
      audioEl.currentTime = 0;
      audioEl.load();
      if (audioEl.readyState >= 4) return resolve(); // already loaded
      audioEl.addEventListener("canplaythrough", onReady, { once: true });
      audioEl.addEventListener("error", onErr, { once: true });
    });

  /** -------- Compare: Play both with mix -------- */
  const playComparison = async () => {
    const user = userAudioRef.current;
    const sample = sampleAudioRef.current;
    if (!sample) return;

    try {
      setComparing(true);
      setError(null);

      // Make sure sources are fresh & loaded
      await loadAndReady(sample);
      if (user && audioURL) {
        user.src = audioURL; // ensure it points to the latest recording
        await loadAndReady(user);
      }

      // Reset to start
      sample.currentTime = 0;
      if (user) user.currentTime = 0;
      applyMix(mix);

      // Start playback (user gesture triggers this function, so it should be allowed)
      const tasks = [sample.play()];
      if (user && audioURL) tasks.push(user.play());
      await Promise.allSettled(tasks);

      // When the sample ends, stop both
      sample.onended = () => stopComparison();
    } catch (err) {
      console.error("Play comparison error:", err);
      setError("Could not play sample/recording (check the sample file path).");
      setComparing(false);
    }
  };

  const stopComparison = () => {
    const user = userAudioRef.current;
    const sample = sampleAudioRef.current;

    if (sample) {
      sample.pause();
      sample.currentTime = 0;
      sample.onended = null;
    }
    if (user) {
      user.pause();
      user.currentTime = 0;
    }
    setComparing(false);
  };

  /** Cleanup blob URL */
  useEffect(() => {
    return () => {
      if (audioURL) URL.revokeObjectURL(audioURL);
    };
  }, [audioURL]);

  /** -------- UI -------- */
  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 12 }}>Accent Coach AI</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button style={styles.tabBtn(tab === "practice")} onClick={() => setTab("practice")}>
          Practice
        </button>
        <button
          style={styles.tabBtn(tab === "compare")}
          onClick={() => setTab("compare")}
          disabled={!audioURL}
          title={!audioURL ? "Record something first" : ""}
        >
          Compare
        </button>
      </div>

      {tab === "practice" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={styles.card}>
            <label style={{ fontWeight: 600 }}>Target phrase</label>
            <textarea
              rows={2}
              value={targetPhrase}
              onChange={(e) => setTargetPhrase(e.target.value)}
              style={{ width: "100%", marginTop: 6 }}
            />

            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 600 }}>Target accent</label>
              <select
                value={targetAccent}
                onChange={(e) => setTargetAccent(e.target.value)}
                style={{ marginLeft: 10 }}
              >
                <option>American</option>
                <option>British</option>
                <option>Australian</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {!recording ? (
              <button style={styles.primaryBtn} onClick={startRecording}>🎙 Start recording</button>
            ) : (
              <button style={styles.dangerBtn} onClick={stopRecording}>⏹ Stop</button>
            )}
            <button style={styles.grayBtn} onClick={analyzeAudio} disabled={!audioURL || busy}>
              Analyze
            </button>
          </div>

          {audioURL && (
            <div style={styles.card}>
              <h3 style={{ marginTop: 0 }}>Your Recording</h3>
              <audio controls src={audioURL} />
            </div>
          )}

          {busy && <p>Analyzing…</p>}
          {error && <p style={{ color: "red" }}>{error}</p>}

          {score && (
            <div style={styles.card}>
              <h2 style={{ marginTop: 0 }}>Score: {score}/100</h2>
              {feedback && (
                <>
                  <p>{feedback.overall}</p>
                  {feedback.focusAreas?.length > 0 && (
                    <>
                      <h4>Focus areas</h4>
                      <ul>
                        {feedback.focusAreas.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {feedback.wordTips?.length > 0 && (
                    <>
                      <h4>Word tips</h4>
                      <ul>
                        {feedback.wordTips.map((t, i) => (
                          <li key={i}>
                            <b>{t.word}:</b> {t.note}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "compare" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>Pronunciation comparison</h3>
            <p style={{ margin: 0 }}>
              Blend between the native sample and your voice, then click Play.
            </p>

            {/* hidden players */}
            <audio ref={sampleAudioRef} src={SAMPLE_URL} preload="auto" />
            <audio ref={userAudioRef} src={audioURL || undefined} preload="auto" />

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <span>Native</span>
              <input
                type="range"
                min={0}
                max={100}
                value={mix}
                onChange={(e) => setMix(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span>You</span>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button
                style={styles.primaryBtn}
                onClick={playComparison}
                disabled={!audioURL || comparing}
                title={!audioURL ? "Record something first" : ""}
              >
                ▶ Play
              </button>
              <button style={styles.grayBtn} onClick={stopComparison} disabled={!comparing}>
                ⏹ Stop
              </button>
            </div>
          </div>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
