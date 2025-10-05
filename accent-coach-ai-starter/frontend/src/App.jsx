import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ------------------------------------------------------------
 * Accent Coach AI – single-file app
 * Tabs: Record, Feedback, Progress, Social, Coach
 * Features:
 *  - Record & analyze (uses your existing backend /api/score)
 *  - Phoneme/word-level style feedback (display from backend)
 *  - Waveform visualization for the last recording
 *  - Personalized learning plan + adaptive difficulty
 *  - Streaks (localStorage)
 *  - Social (mock: share/download last recording + invite link)
 *  - Coach tab (UI placeholder; add real model later)
 *  - Sign-in: Clerk (if key provided), else local mock login
 * ------------------------------------------------------------
 */

// ---------- ENV + Styles ----------
const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || window.location.origin;

const styles = {
  wrap: { maxWidth: 900, margin: "40px auto", padding: "0 16px" },
  h1row: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    justifyContent: "space-between",
  },
  badge: {
    fontSize: 12,
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    padding: "2px 8px",
    borderRadius: 999,
    color: "#0f172a",
  },
  tabs: { display: "flex", gap: 8, margin: "16px 0 24px" },
  tab: (active) => ({
    padding: "8px 14px",
    borderRadius: 999,
    border: active ? "1px solid #1d4ed8" : "1px solid #e5e7eb",
    background: active ? "#e0e7ff" : "white",
    color: active ? "#1e3a8a" : "#111827",
    cursor: "pointer",
    fontWeight: 600,
  }),
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    background: "#fff",
  },
  label: { fontWeight: 600, fontSize: 13, color: "#334155", marginBottom: 6 },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
  },
  select: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
  },
  row: { display: "flex", gap: 8, alignItems: "center" },
  primaryBtn: {
    background: "#1d4ed8",
    color: "#fff",
    padding: "10px 14px",
    border: 0,
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
  },
  dangerBtn: {
    background: "#ef4444",
    color: "#fff",
    padding: "10px 14px",
    border: 0,
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
  },
  ghostBtn: {
    background: "#f8fafc",
    color: "#0f172a",
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
  },
  score: {
    fontSize: 48,
    fontWeight: 800,
    color: "#111827",
    letterSpacing: "-1px",
  },
  chip: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    marginRight: 6,
    marginBottom: 6,
    background: "#f8fafc",
    fontSize: 12,
  },
  muted: { color: "#64748b" },
};

// ---------- Auth (Clerk optional, mock fallback) ----------
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
const useAuth = () => {
  // Clerk present? we don't import the whole Clerk SDK to keep this file simple.
  // Instead we just detect the env var and show hosted links.
  const [user, setUser] = useState(() => {
    if (clerkPubKey) return null; // require real sign in
    // Mock user if no Clerk key configured:
    return JSON.parse(localStorage.getItem("mockUser") || "null");
  });

  const signInUrl = "/sign-in"; // Clerk hosted route (if integrated through main.jsx)
  const signUpUrl = "/sign-up";

  const mockLogin = () => {
    const u = { id: "local-guest", name: "Guest" };
    localStorage.setItem("mockUser", JSON.stringify(u));
    setUser(u);
  };
  const signOut = () => {
    localStorage.removeItem("mockUser");
    setUser(null);
  };

  return { clerkPubKey, user, setUser, signInUrl, signUpUrl, mockLogin, signOut };
};

// ---------- Adaptive difficulty: sentence bank ----------
const SENTENCES = {
  easy: [
    "The quick brown fox jumps over the lazy dog.",
    "I see a cat and a dog.",
    "Please pass the salt.",
  ],
  medium: [
    "Those three thin thieves thought it through.",
    "Red lorry, yellow lorry.",
    "She sells seashells by the seashore.",
  ],
  hard: [
    "The thirty-third thief thought that they thwarted the threshold.",
    "Rarely really rarely rumbles the railway.",
    "Fuzzy Wuzzy was a bear; Fuzzy Wuzzy had no hair.",
  ],
};

// ---------- Component ----------
export default function App() {
  const { user, signInUrl, signUpUrl, mockLogin, signOut, clerkPubKey } =
    useAuth();

  // Tabs
  const [activeTab, setActiveTab] = useState("record");

  // Record/analyze state
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [audioURL, setAudioURL] = useState(null);

  // Form
  const [targetPhrase, setTargetPhrase] = useState(
    "The quick brown fox jumps over the lazy dog."
  );
  const [targetAccent, setTargetAccent] = useState("American");

  // Results
  const [score, setScore] = useState(null); // number
  const [feedback, setFeedback] = useState(null); // {overall, focusAreas[], wordTips[], nextSteps[]}

  // Waveform visualization
  const canvasRef = useRef(null);

  // Progress (localStorage)
  const [streak, setStreak] = useState(0);
  const [lastDay, setLastDay] = useState(""); // YYYY-MM-DD
  const [plan, setPlan] = useState([]); // personalized learning plan

  // --------- Auth gate ----------
  if (!user && clerkPubKey) {
    // Show Clerk hosted links (you enable Clerk in step 3 below)
    return (
      <div style={styles.wrap}>
        <div style={styles.h1row}>
          <h1>Accent Coach AI</h1>
          <span style={styles.badge}>MVP</span>
        </div>
        <div style={styles.card}>
          <h3>Sign in required</h3>
          <p style={styles.muted}>
            Use Google or Apple via Clerk. (You’ll configure keys in Vercel.)
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <a href={signInUrl} style={styles.primaryBtn}>
              Continue with Google / Apple
            </a>
            <a href={signUpUrl} style={styles.ghostBtn}>
              Create account
            </a>
          </div>
        </div>
        <p style={{ ...styles.muted, marginTop: 24 }}>
          Dev mode tip: don’t have Clerk keys yet? Click{" "}
          <button className="link-btn" onClick={mockLogin} style={styles.ghostBtn}>
            Use mock login
          </button>{" "}
          to test locally.
        </p>
      </div>
    );
  }
  if (!user && !clerkPubKey) {
    return (
      <div style={styles.wrap}>
        <div style={styles.h1row}>
          <h1>Accent Coach AI</h1>
          <span style={styles.badge}>MVP</span>
        </div>
        <div style={styles.card}>
          <h3>Welcome</h3>
          <p style={styles.muted}>
            No auth provider configured. Click below to continue as a local test
            user, or add Clerk later.
          </p>
          <button onClick={mockLogin} style={styles.primaryBtn}>
            Continue as Guest
          </button>
        </div>
      </div>
    );
  }

  // --------- Streaks load/save ----------
  useEffect(() => {
    const s = Number(localStorage.getItem("streak") || "0");
    const d = localStorage.getItem("lastDay") || "";
    setStreak(s);
    setLastDay(d);
  }, []);
  function bumpStreakIfNewDay() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== lastDay) {
      const ns = streak + 1;
      setStreak(ns);
      setLastDay(today);
      localStorage.setItem("streak", String(ns));
      localStorage.setItem("lastDay", today);
    }
  }

  // --------- Recording ----------
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
        setAudioURL(url);
        // Draw waveform
        drawWaveform(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      setError("Microphone error. Please allow mic access.");
    }
  }
  function stopRecording() {
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    setRecording(false);
  }

  // --------- Analyze (call your backend) ----------
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
      const data = await res.json(); // {overall, words[], feedback?}
      setScore(data.overall ?? null);
      const fb =
        data.feedback || buildLocalFeedback(targetPhrase, data.words || []);
      setFeedback(fb);
      // learning plan from focus areas
      setPlan(buildPlanFromFeedback(fb));
      bumpStreakIfNewDay();
      setActiveTab("feedback");
      // Adaptive difficulty: switch suggested sentence
      setTargetPhrase(nextSentenceByDifficulty(data.overall ?? 0));
    } catch (e) {
      console.error(e);
      setError("Analyze failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // --------- Visualization ----------
  async function drawWaveform(blob) {
    try {
      const arrayBuf = await blob.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      const ch = audioBuf.getChannelData(0);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const W = (canvas.width = canvas.clientWidth);
      const H = (canvas.height = 120);
      const c2d = canvas.getContext("2d");
      c2d.clearRect(0, 0, W, H);
      c2d.strokeStyle = "#0ea5e9";
      c2d.lineWidth = 2;
      c2d.beginPath();
      const step = Math.ceil(ch.length / W);
      for (let x = 0; x < W; x++) {
        const start = x * step;
        let min = 1,
          max = -1;
        for (let i = 0; i < step; i++) {
          const v = ch[start + i] || 0;
          if (v < min) min = v;
          if (v > max) max = v;
        }
        const y1 = ((1 - min) * H) / 2;
        const y2 = ((1 - max) * H) / 2;
        c2d.moveTo(x, y1);
        c2d.lineTo(x, y2);
      }
      c2d.stroke();
    } catch {}
  }

  // --------- Local feedback & plan (fallback) ----------
  function buildLocalFeedback(phrase, words) {
    const low = (words || []).filter((w) => (w.score ?? 100) < 80);
    const focus = new Set();
    const tips = [];
    const hasTH = (w) =>
      /\b(th(e|is|at|ose|ese)|think|thought|through)\b/i.test(w);
    const rLike = (w) => /r/i.test(w);
    const finalC = (w) => /[bdfgklmnprsStTz]$/i.test(w);

    for (const it of low.length ? low : [{ word: "the", score: 70 }]) {
      const w = String(it.word || "");
      if (hasTH(w)) {
        focus.add("TH sound (/θ/ /ð/)");
        tips.push({
          word: w,
          note: "Soft TH: tongue lightly on teeth; don’t make D/Z.",
          drill: 'Say “the / this / those” slowly and let air flow.',
        });
      } else if (finalC(w)) {
        focus.add("Final consonants");
        tips.push({
          word: w,
          note: "Hit the final consonant clearly, especially t/d/s.",
          drill: `Say “${w}” three times, over-articulate the ending.`,
        });
      } else if (rLike(w)) {
        focus.add("American ‘r’ / r-colored vowels");
        tips.push({
          word: w,
          note: "Raise and pull back the tongue slightly (not rolled).",
          drill: `Exaggerate the ‘r’ in “${w}” three times.`,
        });
      } else {
        tips.push({
          word: w,
          note: "Slow down and stretch the vowel a bit.",
          drill: `Say “${w}” syllable by syllable slowly (3×).`,
        });
      }
    }

    const avg = words.length
      ? Math.round(words.reduce((s, w) => s + (w.score ?? 100), 0) / words.length)
      : 80;

    let overall;
    if (avg >= 90) overall = `Strong overall (~${avg}/100). Polish minor details.`;
    else if (avg >= 80)
      overall = `Good foundation (~${avg}/100). Focus on a few recurring patterns.`;
    else overall = `High improvement potential (~${avg}/100). Tackle 1–2 sounds.`;

    return {
      overall,
      focusAreas: [...focus],
      wordTips: tips.slice(0, 10),
      nextSteps: [
        "Practice slowly (0.75x speed) and exaggerate difficult sounds.",
        "Record again and check if focus areas improve.",
      ],
    };
  }

  function buildPlanFromFeedback(fb) {
    const areas = fb?.focusAreas || [];
    if (!areas.length) return [];
    return areas.map((a) => ({
      area: a,
      task: `5 minutes minimal pairs + 1 slow read of your sentence focusing on ${a}.`,
    }));
  }

  function nextSentenceByDifficulty(overall) {
    if (overall >= 90) {
      return pickOne(SENTENCES.hard);
    } else if (overall >= 75) {
      return pickOne(SENTENCES.medium);
    }
    return pickOne(SENTENCES.easy);
  }
  function pickOne(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // --------- UI sections ----------
  const recordUI = (
    <>
      <div style={styles.card}>
        <div className="field">
          <div style={styles.label}>Target phrase</div>
          <textarea
            style={styles.input}
            rows={3}
            value={targetPhrase}
            onChange={(e) => setTargetPhrase(e.target.value)}
          />
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <div style={styles.label}>Target accent</div>
          <select
            style={styles.select}
            value={targetAccent}
            onChange={(e) => setTargetAccent(e.target.value)}
          >
            <option>American</option>
            <option>British</option>
            <option>Australian</option>
          </select>
        </div>

        <div style={{ ...styles.row, marginTop: 14 }}>
          {!recording ? (
            <button style={styles.primaryBtn} onClick={startRecording}>
              🎙️ Start recording
            </button>
          ) : (
            <button style={styles.dangerBtn} onClick={stopRecording}>
              ⏹ Stop
            </button>
          )}

          <button
            style={styles.ghostBtn}
            disabled={!audioURL || busy}
            onClick={analyzeAudio}
          >
            🔍 Analyze
          </button>
        </div>

        {error && <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p>}
        {audioURL && (
          <div style={{ marginTop: 12 }}>
            <audio src={audioURL} controls />
          </div>
        )}
      </div>

      {/* Waveform */}
      {audioURL && (
        <div style={styles.card}>
          <div style={styles.label}>Waveform</div>
          <canvas ref={canvasRef} style={{ width: "100%", height: 120 }} />
        </div>
      )}

      {/* Result summary */}
      {(score != null || feedback) && (
        <div style={styles.card}>
          <div style={styles.label}>Last result</div>
          <div className="row" style={styles.row}>
            {score != null && <div style={styles.score}>{score}</div>}
            <div>
              <div style={styles.muted}>{feedback?.overall}</div>
              {!!feedback?.focusAreas?.length && (
                <div style={{ marginTop: 8 }}>
                  {feedback.focusAreas.map((f, i) => (
                    <span key={i} style={styles.chip}>
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const feedbackUI = (
    <div style={styles.card}>
      {!feedback ? (
        <p style={styles.muted}>Analyze a recording to see smart feedback.</p>
      ) : (
        <>
          <h3 style={{ marginTop: 0 }}>Smart feedback</h3>
          <p>{feedback.overall}</p>

          {!!feedback.focusAreas?.length && (
            <>
              <h4>Focus areas</h4>
              <div style={{ marginBottom: 10 }}>
                {feedback.focusAreas.map((f, i) => (
                  <span key={i} style={styles.chip}>
                    {f}
                  </span>
                ))}
              </div>
            </>
          )}

          {!!feedback.wordTips?.length && (
            <>
              <h4>Word-level tips</h4>
              <ul>
                {feedback.wordTips.map((t, i) => (
                  <li key={i}>
                    <strong>{t.word}:</strong> {t.note} <em>— {t.drill}</em>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!!feedback.nextSteps?.length && (
            <>
              <h4>Next steps</h4>
              <ul>
                {feedback.nextSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );

  const progressUI = (
    <>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Streaks & badges</h3>
        <p>
          Current streak: <strong>{streak}</strong> day{streak === 1 ? "" : "s"}
        </p>
        <div style={{ marginTop: 8 }}>
          {streak >= 7 && <span style={styles.chip}>🔥 7-day streak</span>}
          {score >= 95 && <span style={styles.chip}>⭐ 95+ Mastery</span>}
          {score >= 90 && score < 95 && (
            <span style={styles.chip}>💪 90+ Strong</span>
          )}
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Personalized learning plan</h3>
        {!plan?.length ? (
          <p style={styles.muted}>Analyze to generate a plan.</p>
        ) : (
          <ol>
            {plan.map((p, i) => (
              <li key={i}>
                <strong>{p.area}</strong>: {p.task}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Adaptive difficulty</h3>
        <p style={styles.muted}>
          Your next suggested sentence is based on your last score.
        </p>
        <div className="row" style={{ ...styles.row, marginTop: 8 }}>
          <button
            style={styles.ghostBtn}
            onClick={() => setTargetPhrase(nextSentenceByDifficulty(score ?? 0))}
          >
            🎯 Pick a new sentence for me
          </button>
          <button
            style={styles.primaryBtn}
            onClick={() => setActiveTab("record")}
          >
            Use it in Record tab
          </button>
        </div>
      </div>
    </>
  );

  const socialUI = (
    <>
      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Compare with friends</h3>
        <p style={styles.muted}>
          Share your result link and see who can beat your score.
        </p>
        <div className="row" style={{ ...styles.row, marginTop: 8 }}>
          <input
            style={styles.input}
            readOnly
            value={`${window.location.origin}?u=${encodeURIComponent(
              user?.id || "guest"
            )}&s=${score ?? ""}`}
          />
          <button
            style={styles.ghostBtn}
            onClick={() =>
              navigator.clipboard.writeText(
                `${window.location.origin}?u=${encodeURIComponent(
                  user?.id || "guest"
                )}&s=${score ?? ""}`
              )
            }
          >
            Copy link
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Share a progress clip</h3>
        <p style={styles.muted}>
          Download your last recording (you can upload to TikTok/Instagram).
        </p>
        <div className="row" style={{ ...styles.row, marginTop: 8 }}>
          <button
            style={styles.ghostBtn}
            disabled={!audioURL}
            onClick={() => {
              if (!audioURL) return;
              const a = document.createElement("a");
              a.href = audioURL;
              a.download = "pronunciation.webm";
              a.click();
            }}
          >
            ⬇️ Download last recording
          </button>
        </div>
      </div>
    </>
  );

  const coachUI = (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0 }}>AI Coach</h3>
      <p style={styles.muted}>
        Ask why a sound is tricky and how to fix it. (Placeholder UI — wire this
        up to your favorite LLM when ready.)
      </p>
      <CoachBox targetPhrase={targetPhrase} feedback={feedback} />
    </div>
  );

  // --------- Render ----------
  return (
    <div style={styles.wrap}>
      <div style={styles.h1row}>
        <h1>Accent Coach AI</h1>
        <div className="row" style={styles.row}>
          <span style={styles.badge}>MVP</span>
          <button style={styles.ghostBtn} onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={styles.tab(activeTab === "record")}
          onClick={() => setActiveTab("record")}
        >
          🎙️ Record
        </button>
        <button
          style={styles.tab(activeTab === "feedback")}
          onClick={() => setActiveTab("feedback")}
        >
          🧠 Feedback
        </button>
        <button
          style={styles.tab(activeTab === "progress")}
          onClick={() => setActiveTab("progress")}
        >
          📈 Progress
        </button>
        <button
          style={styles.tab(activeTab === "social")}
          onClick={() => setActiveTab("social")}
        >
          👥 Social
        </button>
        <button
          style={styles.tab(activeTab === "coach")}
          onClick={() => setActiveTab("coach")}
        >
          🤖 Coach
        </button>
      </div>

      {activeTab === "record" && recordUI}
      {activeTab === "feedback" && feedbackUI}
      {activeTab === "progress" && progressUI}
      {activeTab === "social" && socialUI}
      {activeTab === "coach" && coachUI}

      <p style={{ ...styles.muted, marginTop: 24 }}>
        API: {API_BASE}
      </p>
    </div>
  );
}

// ---------- Small coach text box (placeholder) ----------
function CoachBox({ targetPhrase, feedback }) {
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "Hi! I’m your AI coach. Ask me why a sound is hard, or how to improve it. (This is a demo UI — connect me to an LLM later.)",
    },
  ]);

  function ask() {
    if (!q.trim()) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    // Fake helpful reply using current feedback context:
    const focus = feedback?.focusAreas?.[0] || "TH sound";
    const reply = `For "${focus}", try slow, exaggerated practice: put your tongue slightly forward and let air flow. Record again focusing on only this.`;
    setTimeout(() => {
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    }, 400);
    setQ("");
  }

  return (
    <div>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 12,
          maxHeight: 220,
          overflow: "auto",
          marginBottom: 10,
          background: "#fafafa",
        }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <strong>{m.role === "assistant" ? "Coach" : "You"}:</strong>{" "}
            {m.text}
          </div>
        ))}
      </div>
      <div className="row" style={{ display: "flex", gap: 8 }}>
        <input
          style={styles.input}
          placeholder="Ask about a sound, e.g., 'How do I improve my TH?'"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
        />
        <button style={styles.primaryBtn} onClick={ask}>
          Send
        </button>
      </div>
    </div>
  );
}
