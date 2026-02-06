// src/pages/PracticeMyText.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronDown, ArrowUp, StopCircle, Volume2, Play } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import * as sfx from "../lib/sfx.js";

const IS_PROD = !!import.meta?.env?.PROD;
const RESULT_KEY = "ac_practice_my_text_result_v1";

/* ------------ API base (web + native) ------------ */
function isNative() {
  return !!(window?.Capacitor && window.Capacitor.isNativePlatform);
}
function getApiBase() {
  const ls = (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) || "";
  const env = (import.meta?.env && import.meta.env.VITE_API_BASE) || "";
  if (isNative()) {
    const base = (ls || env).replace(/\/+$/, "");
    if (!base) throw new Error("VITE_API_BASE (or localStorage.apiBase) is not set — required on iOS.");
    return base;
  }
  return (ls || env || window.location.origin).replace(/\/+$/, "");
}

function clamp01(v) {
  const n = Number(v);
  if (!isFinite(n)) return null;
  return n <= 1 ? Math.max(0, Math.min(1, n)) : Math.max(0, Math.min(1, n / 100));
}

// PSM-style: duration-weighted phoneme score -> word score (0-100)
function wordScore100LikePSM(wordObj) {
  const phs = Array.isArray(wordObj?.phonemes) ? wordObj.phonemes : [];
  if (!phs.length) return null;

  let num = 0;
  let den = 0;

  for (const ph of phs) {
    const s01 = clamp01(
      ph.pronunciation ??
        ph.accuracy_score ??
        ph.pronunciation_score ??
        ph.score ??
        ph.accuracy ??
        ph.accuracyScore ??
        ph.accuracyScore
    );
    if (s01 == null) continue;

    const span = ph.span || ph.time || null;
    const start10 = span?.start ?? span?.s ?? null;
    const end10 = span?.end ?? span?.e ?? null;

    const dur =
      typeof start10 === "number" && typeof end10 === "number" && end10 > start10
        ? (end10 - start10) * 0.01
        : 1;

    num += s01 * dur;
    den += dur;
  }

  if (!den) return null;
  return Math.round((num / den) * 100);
}

// PSM-style: sentence score = avg of word scores (ignore nulls)
function psmSentenceScoreFromApi(json) {
  const apiWords = Array.isArray(json?.words) ? json.words : [];
  const wordScores = apiWords.map((w) => wordScore100LikePSM(w)).filter((v) => Number.isFinite(v));
  const overall = wordScores.length ? Math.round(wordScores.reduce((a, b) => a + b, 0) / wordScores.length) : 0;
  return { overall, wordScores };
}

function sanitizeTextForSubmit(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim();
}
function sanitizeTextForPaste(raw) {
  return String(raw || "").replace(/\s+/g, " ");
}

function pickFeedback(json) {
  const overall = Number(json?.overall ?? json?.pronunciation ?? json?.overallAccuracy ?? 0);
  if (overall >= 95)
    return ["Unreal! 🔥", "Insane clarity! 🌟", "Flawless! 👑", "You’re on fire! 🚀"][Math.floor(Math.random() * 4)];
  if (overall >= 90)
    return ["Awesome work! 💪", "Super clean! ✨", "You nailed it! ✅", "Crisp & clear! 🎯"][Math.floor(Math.random() * 4)];
  if (overall >= 75)
    return ["Great progress — keep going! 🙌", "Nice! Try slightly slower. ⏱️", "Solid! Listen once more, then record. 👂"][
      Math.floor(Math.random() * 3)
    ];
  return ["Good start — emphasize the stressed syllable. 🔊", "Try again a bit slower. 🐢", "Listen once more, then record. 👂"][
    Math.floor(Math.random() * 3)
  ];
}
/* ---------------- Coach-like feedback helpers ---------------- */

function getScore(obj) {
  const v =
    obj?.accuracyScore ??
    obj?.overallAccuracy ??
    obj?.accuracy ??
    obj?.pronunciation ??
    obj?.score ??
    obj?.overall ??
    obj?.pronunciationAccuracy ??
    obj?.accuracy_score;

  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function scoreColor(score) {
  if (score == null) return "rgba(17,24,39,0.55)";
  if (score >= 85) return "#16a34a";
  if (score >= 70) return "#f59e0b";
  return "#ef4444";
}

function isGreen(score) {
  return score != null && score >= 85;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getPhonemeCode(p) {
  return String(p?.phoneme || p?.ipa || p?.symbol || "").trim().toUpperCase();
}

function normalizePhonemeScore(phonemeScore, wordScore, allPhonemeScores) {
  if (phonemeScore == null || wordScore == null) return phonemeScore;
  const scores = (allPhonemeScores || []).filter((x) => Number.isFinite(x));
  if (!scores.length) return phonemeScore;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const shift = wordScore - mean;
  return clamp(phonemeScore + shift, 0, 100);
}

function normalizeWordsFromResult(result, fallbackText) {
  const arr = Array.isArray(result?.words) ? result.words : null;
  if (arr?.length) return arr;

  const text = String(fallbackText || "").trim();
  if (!text) return [];
  const parts = text.split(/\s+/g).filter(Boolean);
  return parts.map((w) => ({ word: w, phonemes: [] }));
}

function resolvePhonemeVideo(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  return { videoSrc: `/phonemes/Videos/${c}.mp4` };
}

export default function PracticeMyText() {
  const nav = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();

  const MAX_LEN = 220;

  // Light tokens aligned with Coach
  const LIGHT_TEXT = "rgba(17,24,39,0.92)";
  const LIGHT_MUTED = "rgba(17,24,39,0.55)";
  const LIGHT_BORDER = "rgba(0,0,0,0.10)";
  const LIGHT_SHADOW = "0 10px 24px rgba(0,0,0,0.06)";
  const LIGHT_SURFACE = "#FFFFFF";
  const LIGHT_BG = "#EEF5FF";
  const SEND_PURPLE = "#8B5CF6";

  const TABBAR_OFFSET = 64;
  const SAFE_BOTTOM = "env(safe-area-inset-bottom, 0px)";
  const SAFE_TOP = "env(safe-area-inset-top, 0px)";

  // keep SFX volume synced with settings (0 = mute)
  useEffect(() => {
    sfx.setVolume(settings.volume ?? 0.6);
  }, [settings.volume]);
  const canPlaySfx = (settings.volume ?? 0) > 0.001;

  const [accentUi, setAccentUi] = useState(settings.accentDefault || "en_us");
  useEffect(() => setAccentUi(settings.accentDefault || "en_us"), [settings.accentDefault]);

  const [refText, setRefText] = useState("");
  const [err, setErr] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isBusy = isRecording || isAnalyzing;

  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const [lastUrl, setLastUrl] = useState(null);

  const [result, setResult] = useState(null);
  // Load analysis result from Practice.jsx (via navigate state or sessionStorage)
useEffect(() => {
  const fromState = location?.state?.result || null;

  if (fromState) {
    setResult(fromState);
    try { sessionStorage.setItem(RESULT_KEY, JSON.stringify(fromState)); } catch {}
    return;
  }

  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (raw) setResult(JSON.parse(raw));
  } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [location.key]);

  // ---------------- Coach-like overlay state ----------------
  const [selectedWordIdx, setSelectedWordIdx] = useState(-1);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "phoneme"
  const [activePhonemeKey, setActivePhonemeKey] = useState(null); // e.g. "UW_3"
  const [videoMuted, setVideoMuted] = useState(true);
  const videoRef = useRef(null);

  const words = useMemo(() => normalizeWordsFromResult(result, result?.refText), [result]);
  const maxIdx = Math.max(0, (words?.length || 1) - 1);
  const safeWordIdx = selectedWordIdx < 0 ? -1 : Math.max(0, Math.min(selectedWordIdx, maxIdx));
  const currentWordObj = safeWordIdx >= 0 ? (words?.[safeWordIdx] || null) : null;

  const currentWordText = String(currentWordObj?.word || currentWordObj?.text || "").trim();
  const currentWordScore = getScore(currentWordObj);

  const phonemeLineItems = useMemo(() => {
    const ps = Array.isArray(currentWordObj?.phonemes) ? currentWordObj.phonemes : [];
    const out = [];

    const rawScores = ps.map(getScore).filter((x) => Number.isFinite(x));
    const wordScore = getScore(currentWordObj);

    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const code = getPhonemeCode(p);
      if (!code) continue;

      const raw = getScore(p);
      const s = normalizePhonemeScore(raw, wordScore, rawScores);

      const assets = resolvePhonemeVideo(code);

      out.push({
        key: `${code}_${i}`,
        code,
        score: s,
        rawScore: raw,
        assets,
        hasVideo: !!assets?.videoSrc,
        isWeak: s == null || !isGreen(s),
      });
    }

    return out;
  }, [currentWordObj]);

  const weakItems = useMemo(
    () => phonemeLineItems.filter((x) => x.hasVideo && x.isWeak),
    [phonemeLineItems]
  );
const activeWeakItem = useMemo(() => {
  if (!activePhonemeKey) return null;
  return weakItems.find((x) => x.key === activePhonemeKey) || null;
}, [weakItems, activePhonemeKey]);

  // auto-select first word when we get a result
  useEffect(() => {
    if (!result) return;
    if (words?.length && selectedWordIdx < 0) setSelectedWordIdx(0);
    setActiveTab("overview");
    setActivePhonemeKey(null);
    setVideoMuted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);



  function disposeRecorder() {
    try {
      mediaRecRef.current?.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    mediaRecRef.current = null;
  }

  async function ensureMic() {
    disposeRecorder();
    if (!navigator?.mediaDevices?.getUserMedia) throw new Error("Microphone not supported on this device.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    let options = {};
    if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) options.mimeType = "audio/webm;codecs=opus";
      else if (MediaRecorder.isTypeSupported("audio/webm")) options.mimeType = "audio/webm";
      else if (MediaRecorder.isTypeSupported("audio/mp4")) options.mimeType = "audio/mp4";
    }

    let rec;
    try {
      rec = new MediaRecorder(stream, options);
    } catch {
      rec = new MediaRecorder(stream);
    }

    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e?.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => handleStop(rec);
    mediaRecRef.current = rec;
  }

  function handleStop(rec) {
    setIsRecording(false);

    const chunks = chunksRef.current.slice();
    chunksRef.current = [];

    disposeRecorder();
    try {
      if (lastUrl) URL.revokeObjectURL(lastUrl);
    } catch {}

    const type = chunks[0]?.type || rec?.mimeType || "audio/webm";
    const blob = new Blob(chunks, { type });

    const localUrl = URL.createObjectURL(blob);
    setLastUrl(localUrl);
    setIsAnalyzing(true);
    sendToServer(blob, localUrl);
  }

  async function startPronunciationRecord() {
    if (!refText.trim()) {
      setErr("Type something first.");
      return;
    }
    try {
      setErr("");
      await ensureMic();
      chunksRef.current = [];
      mediaRecRef.current.start();
      setIsRecording(true);
      if (canPlaySfx) sfx.warm();
    } catch (e) {
      if (!IS_PROD) setErr("Microphone error: " + (e?.message || String(e)));
      else setErr("Microphone access is blocked. Please allow it and try again.");
      setIsRecording(false);
      if (canPlaySfx) sfx.softFail();
    }
  }

  function stopPronunciationRecord() {
    try {
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
    } catch {}
  }

  async function togglePronunciationRecord() {
    if (isRecording) stopPronunciationRecord();
    else if (!isAnalyzing) await startPronunciationRecord();
  }

  async function sendToServer(audioBlob, localUrl) {
    try {
      const text = sanitizeTextForSubmit(refText);
      const base = getApiBase();

      const fd = new FormData();
      fd.append("audio", audioBlob, "clip.webm");
      fd.append("refText", text);
      fd.append("accent", accentUi === "en_br" ? "en_br" : "en_us");

      // hard timeout
      const controller = new AbortController();
      const timeoutMs = 12000;
      const t = setTimeout(() => controller.abort(), timeoutMs);

      let r;
      let json = {};
      let psm = null;

      try {
        r = await fetch(`${base}/api/analyze-speech`, {
          method: "POST",
          body: fd,
          signal: controller.signal,
        });

        clearTimeout(t);

        const ct = r.headers?.get("content-type") || "";
        if (ct.includes("application/json")) {
          json = await r.json().catch(() => ({}));
        } else {
          const txt = await r.text().catch(() => "");
          json = txt ? { error: txt } : {};
        }

        if (!r.ok) throw new Error(json?.error || r.statusText || "Analyze failed");

        psm = psmSentenceScoreFromApi(json);
        json = { ...json, overall: psm.overall, pronunciation: psm.overall, overallAccuracy: psm.overall };
      } catch (e) {
        clearTimeout(t);
        if (e?.name === "AbortError") throw new Error("Analysis timed out. Please try again.");
        throw e;
      }

      const overall = Number(psm?.overall ?? json?.overall ?? 0);

      if (canPlaySfx) {
        if (overall >= 90) sfx.success({ strength: 2 });
        else if (overall >= 75) sfx.success({ strength: 1 });
      }

      const payload = {
        ...json,
        overall,
        pronunciation: overall,
        overallAccuracy: overall,
        psmWordScores: Array.isArray(psm?.wordScores) ? psm.wordScores : [],
        userAudioUrl: localUrl,
        userAudioBlob: audioBlob,
        refText: text,
        accent: accentUi,
        inlineMsg: pickFeedback({ ...json, overall }),
        createdAt: Date.now(),
      };

      setResult(payload);
    } catch (e) {
      if (!IS_PROD) setErr(e?.message || String(e));
      else setErr("Something went wrong. Try again.");
      if (canPlaySfx) sfx.softFail();
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="page" style={{ minHeight: "100vh", background: LIGHT_BG, color: LIGHT_TEXT }}>
      {/* Header (like Coach) */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "auto" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: `calc(${SAFE_TOP} + 32px) 16px 14px` }}>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -0.4 }}>Practice My Text</div>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ height: `calc(${SAFE_TOP} + 76px)` }} />

      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "0 16px",
          paddingBottom: `calc(${TABBAR_OFFSET}px + 24px + ${SAFE_BOTTOM})`,
        }}
      >
        {/* Top row (back + accent) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button
            type="button"
            onClick={() => nav(-1)}
            aria-label="Back"
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              border: `1px solid ${LIGHT_BORDER}`,
              background: LIGHT_SURFACE,
              boxShadow: LIGHT_SHADOW,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <div style={{ position: "relative", flex: "0 0 auto" }}>
            <select
              aria-label="Accent"
              value={accentUi}
              onChange={(e) => !isBusy && setAccentUi(e.target.value)}
              disabled={isBusy}
              style={{
                height: 44,
                borderRadius: 16,
                padding: "0 12px",
                fontWeight: 900,
                color: LIGHT_TEXT,
                background: LIGHT_SURFACE,
                border: `1px solid ${LIGHT_BORDER}`,
                boxShadow: LIGHT_SHADOW,
                outline: "none",
                cursor: isBusy ? "not-allowed" : "pointer",
                appearance: "none",
                paddingRight: 34,
              }}
              title="Accent"
            >
              <option value="en_us">🇺🇸</option>
              <option value="en_br">🇬🇧</option>
            </select>

            <ChevronDown
              className="h-4 w-4"
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: LIGHT_MUTED,
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

     

{/* Coach-like feedback */}
<div style={{ marginTop: 14 }}>
  {!result ? (
    <div
      style={{
        borderRadius: 22,
        background: LIGHT_SURFACE,
        border: `1px solid ${LIGHT_BORDER}`,
        boxShadow: LIGHT_SHADOW,
        padding: 14,
        color: LIGHT_MUTED,
        fontWeight: 900,
        textAlign: "center",
      }}
    >
      No result yet.
    </div>
  ) : (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Words list (Overview) */}
      {activeTab === "overview" ? (
        <div
          style={{
            borderRadius: 22,
            background: LIGHT_SURFACE,
            border: `1px solid ${LIGHT_BORDER}`,
            boxShadow: LIGHT_SHADOW,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 14, color: LIGHT_MUTED, marginBottom: 10 }}>Words</div>

          <div style={{ display: "grid", gap: 10 }}>
            {words.map((w, idx) => {
              const t = String(w?.word || w?.text || "").trim();
              const s = getScore(w);
              const active = idx === safeWordIdx;

              return (
                <button
                  key={`${t}_${idx}`}
                  type="button"
                  onClick={() => {
                    setSelectedWordIdx(idx);
                    setActiveTab("overview");
                    setActivePhonemeKey(null);
                    setVideoMuted(true);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: active ? "rgba(33,150,243,0.10)" : "transparent",
                    padding: "12px 12px",
                    borderRadius: 16,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span style={{ fontWeight: 950, color: LIGHT_TEXT }}>{t || `Word ${idx + 1}`}</span>
                  <span style={{ fontWeight: 950, color: scoreColor(s) }}>{s == null ? "—" : Math.round(s)}</span>
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "12px 0" }} />

          {currentWordObj ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 950, fontSize: 14, color: LIGHT_TEXT }}>
                  Selected: <span style={{ fontWeight: 950 }}>{currentWordText || "—"}</span>
                </div>
                <div style={{ fontWeight: 950, color: scoreColor(currentWordScore) }}>
                  {currentWordScore == null ? "—" : Math.round(currentWordScore)}
                </div>
              </div>

              {weakItems.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {weakItems.map((it) => (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => {
                        setActiveTab("phoneme");
                        setActivePhonemeKey(it.key);
                        setVideoMuted(true);
                        try {
                          const v = videoRef.current;
                          if (v) {
                            v.pause();
                            v.currentTime = 0;
                          }
                        } catch {}
                      }}
                      style={{
                        border: "none",
                        background: "rgba(17,24,39,0.06)",
                        padding: "10px 12px",
                        borderRadius: 999,
                        fontWeight: 950,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>{it.code}</span>
                      <span style={{ color: scoreColor(it.score) }}>{it.score == null ? "—" : Math.round(it.score)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ color: LIGHT_MUTED, fontWeight: 800 }}>No weak phonemes with video.</div>
              )}
            </div>
          ) : (
            <div style={{ color: LIGHT_MUTED, fontWeight: 800 }}>Tap a word above to see phonemes.</div>
          )}
        </div>
      ) : null}

      {/* Phoneme view (Coach-like) */}
      {activeTab === "phoneme" ? (
        !activeWeakItem ? (
          <div style={{ color: LIGHT_MUTED, fontWeight: 800 }}>No data for this phoneme.</div>
        ) : (
          <div
            style={{
              marginTop: 0,
              background: "#0B1220",
              borderRadius: 28,
              padding: 18,
              color: "white",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* back (top-right) */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("overview");
                setActivePhonemeKey(null);
                setVideoMuted(true);
                try {
                  const v = videoRef.current;
                  if (v) {
                    v.pause();
                    v.currentTime = 0;
                  }
                } catch {}
              }}
              aria-label="Back"
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                width: 44,
                height: 44,
                borderRadius: 22,
                border: "none",
                background: "rgba(255,255,255,0.10)",
                color: "white",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                fontWeight: 900,
                fontSize: 18,
              }}
            >
              ×
            </button>

            <div style={{ paddingRight: 60 }}>
              <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: -0.5 }}>{activeWeakItem.code}</div>
              <div style={{ marginTop: 6, color: "rgba(255,255,255,0.72)", fontWeight: 650 }}>
                Score: {activeWeakItem.score == null ? "—" : Math.round(activeWeakItem.score)}
              </div>
            </div>

            <div style={{ marginTop: 16, borderRadius: 22, overflow: "hidden", position: "relative", background: "black" }}>
              <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10" }}>
                <video
                  ref={videoRef}
                  src={activeWeakItem.assets?.videoSrc || ""}
                  playsInline
                  muted={videoMuted}
                  preload="auto"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />

                <button
                  type="button"
                  onClick={() => {
                    setVideoMuted((m) => {
                      const next = !m;
                      try {
                        const v = videoRef.current;
                        if (v) v.muted = next;
                      } catch {}
                      return next;
                    });
                  }}
                  aria-label="Mute"
                  style={{
                    position: "absolute",
                    right: 12,
                    top: 12,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    border: "none",
                    background: "rgba(0,0,0,0.35)",
                    color: "white",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <Volume2 className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    try {
                      v.muted = false;
                      setVideoMuted(false);
                      v.currentTime = 0;
                      v.play().catch(() => {});
                    } catch {}
                  }}
                  aria-label="Play"
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 78,
                    height: 78,
                    borderRadius: 39,
                    border: "none",
                    background: "rgba(255,255,255,0.95)",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <Play className="h-8 w-8" style={{ color: "#0B1220" }} />
                </button>
              </div>
            </div>
          </div>
        )
      ) : null}
    </div>
  )}
</div>


      </div>
    </div>
  );
}
