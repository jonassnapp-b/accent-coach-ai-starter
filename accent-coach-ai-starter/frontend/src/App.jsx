import React, { useEffect, useRef, useState } from "react";

// Native sample audio (used for A/B comparison)
const SAMPLE_URL = "/samples/en-US/quick_brown_fox.mp3";

// Backend base URL
const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || window.location.origin;

export default function App() {
  // --- Audio recording state ---
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);

  // --- A/B comparison refs and states ---
  const sampleAudioRef = useRef(null);
  const userAudioRef = useRef(null);
  const [mix, setMix] = useState(50); // 0 = native only, 100 = you only
  const [comparing, setComparing] = useState(false);

  // --- Input state ---
  const [targetPhrase, setTargetPhrase] = useState(
    "The quick brown fox jumps over the lazy dog."
  );
  const [targetAccent, setTargetAccent] = useState("American");

  // --- API / UI state ---
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // --- Apply mix between sample + user ---
  const applyMix = (m) => {
    const user = userAudioRef.current;
    const sample = sampleAudioRef.current;
    if (!user || !sample) return;

    const u = Math.min(Math.max(m, 0), 100) / 100;
    user.volume = u; // right = your recording
    sample.volume = 1 - u; // left = native
  };

  useEffect(() => {
    applyMix(mix);
  }, [mix, audioURL]);

  // --- Recording functions ---
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

  // --- Send audio to backend ---
  async function analyzeAudio() {
    if (!audioURL) return;
    setBusy(true);
    setError(null);
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

  // --- A/B Comparison playback ---
  const playComparison = async () => {
    const user = userAudioRef.current;
    const sample = sampleAudioRef.current;
    if (!sample) return;

    // reset both
    sample.currentTime = 0;
    if (user) user.currentTime = 0;

    applyMix(mix);

    try {
      setComparing(true);
      const plays = [sample.play()];
      if (user && audioURL) plays.push(user.play());
      await Promise.allSettled(plays);
    } catch (err) {
      console.error("Play comparison error:", err);
      setComparing(false);
    }

    sample.onended = () => stopComparison();
  };

  const stopComparison = () => {
    const user = userAudioRef.current;
    const sample = sampleAudioRef.current;

    if (sample) {
      sample.pause();
      sample.currentTime = 0;
    }
    if (user) {
      user.pause();
      user.currentTime = 0;
    }
    setComparing(false);
  };

  // --- Cleanup old audio blob URLs ---
  useEffect(() => {
    return () => {
      if (audioURL) URL.revokeObjectURL(audioURL);
    };
  }, [audioURL]);

  // --- UI ---
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>Accent Coach AI</h1>

      <label>Target phrase:</label>
      <textarea
        rows={2}
        value={targetPhrase}
        onChange={(e) => setTargetPhrase(e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <label>Target accent:</label>
      <select
        value={targetAccent}
        onChange={(e) => setTargetAccent(e.target.value)}
        style={{ marginBottom: 20 }}
      >
        <option>American</option>
        <option>British</option>
        <option>Australian</option>
      </select>

      <div style={{ display: "flex", gap: 12 }}>
        {!recording ? (
          <button onClick={startRecording}>🎙 Start Recording</button>
        ) : (
          <button onClick={stopRecording}>⏹ Stop</button>
        )}
        <button onClick={analyzeAudio} disabled={!audioURL || busy}>
          Analyze pronunciation
        </button>
      </div>

      {audioURL && (
        <div style={{ marginTop: 20 }}>
          <h3>Your Recording:</h3>
          <audio controls src={audioURL} />
        </div>
      )}

      {/* A/B comparison */}
      <div style={{ marginTop: 24, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h3>Pronunciation Comparison</h3>
        <audio ref={sampleAudioRef} src={SAMPLE_URL} preload="auto" />
        <audio ref={userAudioRef} src={audioURL || undefined} preload="auto" />
        <p style={{ fontSize: 14 }}>
          Blend between the native sample and your voice to compare them.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={playComparison} disabled={!audioURL || comparing}>
            ▶ Play
          </button>
          <button onClick={stopComparison} disabled={!comparing}>
            ⏹ Stop
          </button>
        </div>
      </div>

      {/* Results */}
      {busy && <p>Analyzing...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {score && (
        <div style={{ marginTop: 24 }}>
          <h2>Score: {score}/100</h2>
          {feedback && (
            <>
              <h3>Feedback</h3>
              <p>{feedback.overall}</p>
              <ul>
                {feedback.wordTips?.map((t, i) => (
                  <li key={i}>
                    <b>{t.word}:</b> {t.note}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
