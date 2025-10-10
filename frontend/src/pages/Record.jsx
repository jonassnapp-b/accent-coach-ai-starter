// src/pages/Record.jsx
import { useEffect, useRef, useState } from "react";
import { analyzeAudio } from "../lib/api.js";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";

const ACCENTS = [
  { id: "us", label: "American English" },
  { id: "uk", label: "British English" },
  { id: "au", label: "Australian English" },
  { id: "in", label: "Indian English" },
];

export default function Record() {
  const [accent, setAccent] = useState("us");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [blob, setBlob] = useState(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      // ryd op i objectURL
      if (audioURL) URL.revokeObjectURL(audioURL);
    };
  }, [audioURL]);

  async function startRecording() {
    setError("");
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        setBlob(b);
        const url = URL.createObjectURL(b);
        setAudioURL(url);
        // stop tracks
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      setError("Kunne ikke få adgang til mikrofonen: " + (e?.message || e));
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function resetAudio() {
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setAudioURL(null);
    setBlob(null);
    setResult(null);
    setError("");
  }

  async function handleAnalyze() {
    if (!blob) {
      setError("Ingen optagelse endnu.");
      return;
    }
    setAnalyzing(true);
    setError("");
    try {
      const out = await analyzeAudio({ blob, accent });
      setResult(out);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="panel">
      <h2>Record</h2>

      {/* Accent vælger */}
      <label className="field">
        <div className="label">Accent</div>
        <select value={accent} onChange={(e)=>setAccent(e.target.value)}>
          {ACCENTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>

      {/* Optager */}
      <div className="recorder">
        {!recording ? (
          <button className="btn primary" onClick={startRecording}>🎙️ Start recording</button>
        ) : (
          <button className="btn danger" onClick={stopRecording}>⏹ Stop</button>
        )}

        <button className="btn" onClick={resetAudio} disabled={!audioURL && !blob}>↺ Reset</button>
      </div>

      {/* Afspilning */}
      {audioURL && (
        <div style={{marginTop: 12}}>
          <audio controls src={audioURL} />
        </div>
      )}

      {/* Analyse */}
      <div className="actions">
        <button className="btn success" onClick={handleAnalyze} disabled={!blob || analyzing}>
          {analyzing ? "Analyserer…" : "Analyser optagelse"}
        </button>
      </div>

      {!!error && <div className="error">{error}</div>}

      {/* Phoneme feedback i samme fane */}
      <PhonemeFeedback result={result} />
    </div>
  );
}
