import React, { useEffect, useRef, useState } from "react";

// Native sample for A/B comparison
const SAMPLE_URL = "/samples/en-US/quick_brown_fox.mp3";

// Backend base URL: Vercel (Vite) will inject VITE_API_BASE at build time
const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || window.location.origin;

export default function App() {
  /** -----------------------
   *  Media / recording state
   *  ----------------------- */
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null); // your recorded preview

  /** -----------------------
   *  App settings / UI state
   *  ----------------------- */
  const [targetPhrase, setTargetPhrase] = useState(
    "The quick brown fox jumps over the lazy dog."
  );
  const [targetAccent, setTargetAccent] = useState("American");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // API result
  const [score, setScore] = useState(null); // { overall, words: [{word, score}, ...] }
  const [feedback, setFeedback] = useState(null); // {overall, focusAreas, wordTips, nextSteps}

  // Tabs
  const [activeTab, setActiveTab] = useState("record"); // "record" | "compare"

  /** -----------------------
   *  Compare (A/B) state
   *  ----------------------- */
  const sampleAudioRef = useRef(null);
  const userAudioRef = useRef(null);
  const [mix, setMix] = useState(50); // 0 = native only, 100 = you only

  // Keep the two audio elements "blended" by volume
  const applyMix = (m) => {
    const user = userAudioRef.current;
    const sample = sampleAudioRef.current;
    if (!user || !sample) return;

    const u = Math.min(Math.max(m, 0), 100) / 100; // clamp 0..100 -> 0..1
    user.volume = u; // right: more of you
    sample.volume = 1 - u; // left: more native
  };

  // Apply blend whenever slider or sources change
  useEffect(() => {
    applyMix(mix);
  }, [mix, recording, audioURL]);

  // Clean up object URL when component unmounts or audioURL changes
  useEffect(() => {
    return () => {
      if (audioURL) URL.revokeObjectURL(audioURL);
    };
  }, [audioURL]);

  /** -----------------------
   *  Recording
   *  ----------------------- */
  async function startRecording() {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          chunksRef.current.push(evt.data);
        }
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
      };

      mr.start();
      setRecording(true);
    } catch (e) {
      console.error(e);
      setError("Could not access microphone.");
    }
  }

  function stopRecording() {
    try {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current?.stream?.getTracks()?.forEach((t) => t.stop());
      setRecording(false);
    } catch (e) {
      // ignore
    }
  }

  /** -----------------------
   *  Analyze
   *  ----------------------- */
  async function analyzeAudio() {
    if (!audioURL) return;
    setBusy(true);
    setError(null);
    try {
      const resBlob = await fetch(audioURL).then((r) => r.blob());
      const form = new FormData();
      form.append("audio", resBlob, "sample.webm");
      form.append("targetPhrase", targetPhrase);
      form.append("targetAccent", targetAccent);

      const res = await fetch(`${API_BASE}/api/score`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setScore(data);
      setFeedback(data.feedback ?? null);
    } catch (e) {
      console.error(e);
      setError(
        "Scoring failed. Please try again (ensure backend URL is correct)."
      );
    } finally {
      setBusy(false);
    }
  }

  /** -----------------------
   *  Compare controls
   *  ----------------------- */
  function playBoth() {
    const s = sampleAudioRef.current;
    const u = userAudioRef.current;
    if (!s || !u) return;

    // try to align them at 0 for a fair A/B start
    const t = 0;
    s.currentTime = t;
    u.currentTime = t;

    // iOS/Chrome might require user interaction (button click) to allow play()
    s.play();
    u.play();
  }

  function pauseBoth() {
    sampleAudioRef.current?.pause();
    userAudioRef.current?.pause();
  }

  /** -----------------------
   *  UI
   *  ----------------------- */

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={{ margin: 0 }}>Accent Coach AI</h1>
        <span style={{ opacity: 0.6 }}>MVP</span>
      </header>

      {/* Tabs */}
      <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
        <button
          style={
            activeTab === "record" ? styles.tabBtnActive : styles.tabBtnPassive
          }
          onClick={() => setActiveTab("record")}
        >
          🎤 Record
        </button>
        <button
          style={
            activeTab === "compare" ? styles.tabBtnActive : styles.tabBtnPassive
          }
          onClick={() => setActiveTab("compare")}
          disabled={!audioURL}
          title={!audioURL ? "Record something first" : ""}
        >
          🎚️ Compare
        </button>
      </div>

      {/* RECORD TAB */}
      {activeTab === "record" && (
        <section style={styles.card}>
          <div style={{ marginBottom: 10 }}>
            <label style={styles.label}>Target phrase</label>
            <textarea
              rows={3}
              style={styles.input}
              value={targetPhrase}
              onChange={(e) => setTargetPhrase(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={styles.label}>Target accent</label>
            <select
              style={styles.select}
              value={targetAccent}
              onChange={(e) => setTargetAccent(e.target.value)}
            >
              <option>American</option>
              <option>British</option>
              <option>Australian</option>
              <option>Indian</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            {!recording ? (
              <button style={styles.primaryBtn} onClick={startRecording}>
                ⏺️ Start recording
              </button>
            ) : (
              <button style={styles.dangerBtn} onClick={stopRecording}>
                ⏹ Stop
              </button>
            )}

            <button
              style={styles.grayBtn}
              onClick={analyzeAudio}
              disabled={!audioURL || busy}
              title={!audioURL ? "Record first" : busy ? "Analyzing…" : ""}
            >
              🔍 Analyze
            </button>
          </div>

          {/* Preview of your recording */}
          {audioURL && (
            <div style={{ marginTop: 16 }}>
              <label style={styles.label}>Preview of your recording</label>
              <audio
                ref={userAudioRef}
                src={audioURL}
                controls
                style={{ width: "100%" }}
              />
            </div>
          )}

          {/* Results */}
          {error && <div style={styles.error}>{error}</div>}

          {score && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: "10px 0" }}>Score</h3>
              <div style={styles.scorePill}>
                Overall: <b>{score.overall ?? "—"}/100</b>
              </div>

              {Array.isArray(score.words) && score.words.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <label style={styles.label}>Word scores</label>
                  <ul style={styles.wordList}>
                    {score.words.map((w, i) => (
                      <li key={i} style={styles.wordItem}>
                        <span>{w.word}</span>
                        <span>{w.score}/100</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {feedback && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: "10px 0" }}>Coaching tips</h3>
              <p style={{ marginTop: 6 }}>{feedback.overall}</p>

              {feedback.focusAreas?.length > 0 && (
                <>
                  <label style={styles.label}>Focus areas</label>
                  <ul>
                    {feedback.focusAreas.map((fa, idx) => (
                      <li key={idx}>{fa}</li>
                    ))}
                  </ul>
                </>
              )}

              {feedback.wordTips?.length > 0 && (
                <>
                  <label style={styles.label}>Word-specific tips</label>
                  <ul>
                    {feedback.wordTips.map((t, idx) => (
                      <li key={idx}>
                        <b>{t.word}:</b> {t.note}{" "}
                        {t.drill ? <em>— {t.drill}</em> : null}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {feedback.nextSteps?.length > 0 && (
                <>
                  <label style={styles.label}>Next steps</label>
                  <ul>
                    {feedback.nextSteps.map((n, idx) => (
                      <li key={idx}>{n}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* COMPARE TAB */}
      {activeTab === "compare" && (
        <section style={styles.card}>
          <p style={{ marginTop: 0 }}>
            Play the **native** sample and your **recording** together. Use the
            slider to blend between them.
          </p>

          {/* Native sample */}
          <div style={{ marginTop: 8 }}>
            <label style={styles.label}>Native sample</label>
            <audio
              ref={sampleAudioRef}
              src={SAMPLE_URL}
              controls
              style={{ width: "100%" }}
            />
          </div>

          {/* Your audio (already rendered on Record tab too) */}
          <div style={{ marginTop: 10 }}>
            <label style={styles.label}>Your recording</label>
            <audio
              ref={userAudioRef}
              src={audioURL || undefined}
              controls
              style={{ width: "100%" }}
            />
            {!audioURL && (
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
                (Record something on the Record tab first.)
              </div>
            )}
          </div>

          {/* Blend slider */}
          <div style={{ marginTop: 14 }}>
            <label style={styles.label}>
              Blend: <code>Native</code> ⇄ <code>You</code>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={mix}
              onChange={(e) => setMix(parseInt(e.target.value || "50", 10))}
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {mix <= 5
                ? "Native only"
                : mix >= 95
                ? "You only"
                : `Native ${100 - mix}% / You ${mix}%`}
            </div>
          </div>

          {/* Sync controls */}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              style={styles.primaryBtn}
              onClick={playBoth}
              disabled={!audioURL}
              title={!audioURL ? "Record first" : ""}
            >
              ▶️ Play both
            </button>
            <button style={styles.grayBtn} onClick={pauseBoth}>
              ⏸ Pause
            </button>
          </div>
        </section>
      )}

      <footer style={{ marginTop: 40, opacity: 0.6, fontSize: 13 }}>
        API: <code>{API_BASE}</code>
      </footer>
    </div>
  );
}

/* --------------------------
   Tiny inline styles (simple)
   -------------------------- */
const styles = {
  page: {
    maxWidth: 760,
    padding: 20,
    margin: "0 auto",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, "Apple Color Emoji","Segoe UI Emoji"',
    lineHeight: 1.45,
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  card: {
    marginTop: 16,
    padding: 16,
    border: "1px solid #e6e6e6",
    borderRadius: 10,
    background: "#fff",
  },
  label: { display: "block", fontWeight: 600, marginBottom: 6 },
  input: {
    width: "100%",
    fontSize: 14,
    padding: 8,
    border: "1px solid #d3d3d3",
    borderRadius: 8,
  },
  select: {
    width: "100%",
    fontSize: 14,
    padding: 8,
    border: "1px solid #d3d3d3",
    borderRadius: 8,
  },
  primaryBtn: {
    background: "#2563EB",
    color: "#fff",
    border: 0,
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
  },
  dangerBtn: {
    background: "#DC2626",
    color: "#fff",
    border: 0,
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
  },
  grayBtn: {
    background: "#F3F4F6",
    color: "#111827",
    border: "1px solid #E5E7EB",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "#111827",
    color: "#fff",
    border: 0,
    padding: "8px 12px",
    borderRadius: 999,
    cursor: "pointer",
  },
  tabBtnPassive: {
    background: "#F3F4F6",
    color: "#111827",
    border: "1px solid #E5E7EB",
    padding: "8px 12px",
    borderRadius: 999,
    cursor: "pointer",
  },
  scorePill: {
    display: "inline-block",
    background: "#EEF2FF",
    border: "1px solid #E0E7FF",
    padding: "6px 10px",
    borderRadius: 999,
  },
  wordList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    border: "1px solid #eee",
    borderRadius: 8,
  },
  wordItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 10px",
    borderBottom: "1px solid #f3f3f3",
  },
  error: {
    marginTop: 10,
    color: "#B91C1C",
    background: "#FEE2E2",
    border: "1px solid #fecaca",
    padding: "8px 10px",
    borderRadius: 8,
  },
};
