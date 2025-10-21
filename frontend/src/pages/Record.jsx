// src/pages/Record.jsx
import { useEffect, useRef, useState } from "react";
import { analyzeAudio } from "../lib/api.js";
import PhonemeFeedback from "../components/PhonemeFeedback.jsx";
import { awardPointsFromFeedback } from "../lib/leaderboard.js";

import { Capacitor } from "@capacitor/core";
import { VoiceRecorder } from "capacitor-voice-recorder";

const isNative = Capacitor.isNativePlatform();

async function ensureMicPermission() {
  if (!isNative) return;
  const { value } = await VoiceRecorder.hasAudioRecordingPermission();
  if (!value) await VoiceRecorder.requestAudioRecordingPermission();
}

const AZURE_EN_ACCENTS = [
  { id: "en-US", label: "American English (US)" },
  { id: "en-GB", label: "British English (UK)" },
  { id: "en-AU", label: "Australian English" },
  { id: "en-CA", label: "Canadian English" },
];

// base64 -> Blob (defaults to AAC/M4A if unknown)
function base64ToBlob(b64, mime = "audio/mp4") {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export default function Record() {
  const [accent, setAccent] = useState("en-US");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const cooldownRef = useRef(false);
  const COOLDOWN_MS = 800;

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

    if (isNative) {
      try {
        await ensureMicPermission();
        await VoiceRecorder.startRecording(); // AAC/M4A on iOS
        setRecording(true);
      } catch (e) {
        setError("Native recording failed: " + (e?.message || e));
        setRecording(false);
      }
      return;
    }

    // --- WEB fallback (MediaRecorder) ---
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/webm",
      ];
      const mimeType =
        candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";

      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        setBlob(b);
        setAudioURL(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      setError("Could not access microphone: " + (e?.message || e));
      setRecording(false);
    }
  }

  // IMPORTANT: return the Blob so we can hand it directly to analyze()
  async function stopRecording() {
    if (isNative) {
      try {
        const res = await VoiceRecorder.stopRecording();
        const b64 = res?.value?.recordDataBase64 || "";
        const mime = res?.value?.mimeType || "audio/mp4"; // plugin often says audio/aac
        const b = base64ToBlob(b64, mime);
        setBlob(b);
        setAudioURL(URL.createObjectURL(b));
        return b;
      } catch (e) {
        setError("Native stop failed: " + (e?.message || e));
        return null;
      } finally {
        setRecording(false);
      }
    }

    const mr = mediaRecorderRef.current;
    if (!mr) {
      setRecording(false);
      return null;
    }

    const gotBlob = await new Promise((resolve) => {
      const onStop = () => {
        mr.removeEventListener("stop", onStop);
        const b = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        setBlob(b);
        setAudioURL(URL.createObjectURL(b));
        resolve(b);
      };
      mr.addEventListener("stop", onStop, { once: true });
      mr.stop();
    });

    setRecording(false);
    return gotBlob;
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
    const toSend = b || blob;
    if (!toSend) {
      setError("Ingen optagelse endnu.");
      return;
    }
    setAnalyzing(true);
    setError("");
    try {
      const out = await analyzeAudio({ blob: toSend, accent });
    console.log("UI RESULT:", out);
    console.log("UI RESULT words length:", Array.isArray(out?.words) ? out.words.length : 0);
      setResult(out);
      awardPointsFromFeedback(out);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  function handlePressStart(e) {
    e.preventDefault();
    if (analyzing) return;
    startRecording();
  }

  async function handlePressEnd(e) {
    e.preventDefault();
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    setTimeout(() => (cooldownRef.current = false), COOLDOWN_MS);

    const b = await stopRecording();   // <<— get the blob directly
    if (b) await analyze(b);
    else setError("Ingen optagelse endnu.");
  }

  function handlePressCancel(e) {
    if (recording) handlePressEnd(e);
  }

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

      <label className="field">
        <div className="label">Accent</div>
        <select value={accent} onChange={(e) => setAccent(e.target.value)}>
          {AZURE_EN_ACCENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      <div className="recorder" style={{ gap: 8, display: "flex", alignItems: "center" }}>
        <button
          className="btn primary"
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressCancel}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
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

        <button className="btn" onClick={resetAudio} disabled={!audioURL && !blob}>
          ↺ Reset
        </button>
      </div>

      {audioURL && (
        <div style={{ marginTop: 12 }}>
          <audio controls src={audioURL} />
        </div>
      )}

      {!!error && (
        <div className="error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      <PhonemeFeedback result={result} />
    </div>
  );
}
