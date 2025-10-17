// src/pages/Record.jsx
import { useEffect, useRef, useState } from "react";
import { analyzeAudio } from "../lib/api.js";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";
import { awardPointsFromFeedback } from "../lib/leaderboard.js";

/**
 * Engelske locale-varianter som Azure Speech (STT + Pronunciation Assessment) typisk understøtter.
 * Listen kan udvides/trimmes efter behov.
 */
const AZURE_EN_ACCENTS = [
  { id: "en-US", label: "American English (US)" },
  { id: "en-GB", label: "British English (UK)" },
  { id: "en-AU", label: "Australian English" },
  { id: "en-CA", label: "Canadian English" },
];



export default function Record() {
  const [accent, setAccent] = useState("en-US");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const onStopResolveRef = useRef(null);
// Cooldown to prevent accidental re-trigger after release
  const cooldownRef = useRef(false);
  const COOLDOWN_MS = 800; // adjust if you like

  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [blob, setBlob] = useState(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (audioURL) URL.revokeObjectURL(audioURL);
    };
  }, [audioURL]);

  async function startRecording() {
    setError("");
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const candidates = [
        "audio/ogg; codecs=opus",
        "audio/webm; codecs=opus",
        "audio/webm",
      ];
      const mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) || "";

      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setBlob(b);
        const url = URL.createObjectURL(b);
        setAudioURL(url);
        stream.getTracks().forEach(t => t.stop());

        if (onStopResolveRef.current) {
          onStopResolveRef.current(b);
          onStopResolveRef.current = null;
        }
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      setError("Could not access microphone: " + (e?.message || e));
    }
  }

  function stopRecording() {
  return new Promise((resolve) => {
    const mr = mediaRecorderRef.current;
    if (!mr) return resolve();

    // Resolve AFTER the 'stop' event has fired (blob is set in onstop)
    const done = () => {
      mr.removeEventListener('stop', done);
      resolve();
    };
    mr.addEventListener('stop', done, { once: true });

    mr.stop();
    setRecording(false);
  });
}


  function resetAudio() {
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setAudioURL(null);
    setBlob(null);
    setResult(null);
    setError("");
  }

  async function analyze(b) {
    const audioBlob = b || blob;
    if (!audioBlob) {
      setError("Ingen optagelse endnu.");
      return;
    }
    setAnalyzing(true);
    setError("");
    try {
      const out = await analyzeAudio({ blob: audioBlob, accent }); // accent er nu fx "en-US"
      setResult(out);
      awardPointsFromFeedback(out);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  // Press-and-hold UX
  function handlePressStart(e) {
  e.preventDefault();
  if (analyzing) return; // don’t start while analyzing
  startRecording();
}

async function handlePressEnd(e) {
  e.preventDefault();

  // Debounce against double releases (mouse+touch firing back-to-back)
  if (cooldownRef.current) return;
  cooldownRef.current = true;
  setTimeout(() => { cooldownRef.current = false; }, COOLDOWN_MS);

  await stopRecording();   // wait until media has actually stopped & blob is set
  await handleAnalyze();   // then analyze once
}

function handlePressCancel(e) {
  // If pointer leaves the button, treat like release
  if (recording) handlePressEnd(e);
}


  // Space/Enter keyboard support når knappen er fokuseret
  function onKeyDown(e) {
    if ((e.code === "Space" || e.code === "Enter") && !recording) {
      e.preventDefault();
      startRecording();
    }
  }
  function onKeyUp(e) {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      handlePressEnd(e);
    }
  }

  return (
    <div className="panel">
      <h2>Record</h2>

      {/* Accent vælger */}
      <label className="field">
        <div className="label">Accent</div>
        <select value={accent} onChange={(e)=>setAccent(e.target.value)}>
          {AZURE_EN_ACCENTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>

      {/* Optag: hold inde for at optage, slip for at analysere */}
      <div className="recorder" style={{ gap: 8, display: 'flex', alignItems: 'center' }}>
        <button
  className="btn primary"
  onMouseDown={handlePressStart}
  onMouseUp={handlePressEnd}
  onMouseLeave={handlePressCancel}
  onTouchStart={handlePressStart}
  onTouchEnd={handlePressEnd}
  onContextMenu={(e) => e.preventDefault()}  // prevent long-press menu on mobile
  disabled={analyzing}
>
  {analyzing ? (
    <>
      <span className="spinner" aria-hidden="true" /> Analyzing…
    </>
  ) : recording ? (
    "Release to analyze"
  ) : (
    "Hold for at optage"
  )}
</button>


        <button className="btn" onClick={resetAudio} disabled={!audioURL && !blob}>↺ Reset</button>
      </div>

      {/* Afspilning */}
      {audioURL && (
        <div style={{marginTop: 12}}>
          <audio controls src={audioURL} />
        </div>
      )}

      {!!error && <div className="error" style={{marginTop: 12}}>{error}</div>}

      {/* Phoneme feedback  */}
      <PhonemeFeedback result={result} />
      {/* Du kan evt. vise out?.transcript et andet sted, hvis din komponent ikke gør det */}
    </div>
  );
}
