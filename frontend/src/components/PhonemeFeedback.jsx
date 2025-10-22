// src/components/PhonemeFeedback.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/** Map score 0–1 to a smooth color from red→yellow→green (HSL). */
function scoreToColor01(s) {
  const clamped = Math.max(0, Math.min(1, Number(s) || 0));
  const hue = clamped * 120; // 0=red, 120=green
  const sat = 75;
  const light = 45;
  return `hsl(${hue}deg ${sat}% ${light}%)`;
}

/** Simple count-up animation (0 → target) for the big percentage display. */
function useCountUp(target, ms = 900) {
  const [val, setVal] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    if (typeof target !== "number") return;
    let raf;
    const animate = (t) => {
      if (startRef.current == null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / ms);
      setVal(target * p);
      if (p < 1) raf = requestAnimationFrame(animate);
    };
    setVal(0);
    startRef.current = null;
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return val;
}

export default function PhonemeFeedback({ result }) {
  if (!result) return null;

  // --- Show API/server errors (even when HTTP=200 but payload contains error) ---
  const apiErr =
    result.error ||
    result.errId ||
    (result._debug && (result._debug.errId || result._debug.error));

  if (apiErr) {
    return (
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Phoneme feedback</h3>
        <div style={{ color: "crimson" }}>{String(apiErr)}</div>
        {result._debug ? (
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>
            {JSON.stringify(result._debug, null, 2)}
          </pre>
        ) : null}
      </div>
    );
  }

  const words = Array.isArray(result.words) ? result.words : [];

  // overall (0–1) – also support overallAccuracy (0–100)
  let overall01 =
    typeof result.overall === "number"
      ? result.overall
      : typeof result.overallAccuracy === "number"
      ? result.overallAccuracy / 100
      : null;

  // If no words and overall is 0/empty → treat as "no score"
  if ((overall01 === 0 || overall01 == null) && words.length === 0) {
    overall01 = null;
  }

  const countVal = useCountUp(overall01 != null ? overall01 * 100 : 0);

  // Find weakest phonemes across all words
  const weakestPhonemes = useMemo(() => {
    const acc = [];
    for (const w of words) {
      if (!Array.isArray(w?.phonemes)) continue;
      for (const p of w.phonemes) {
        const ph = p?.ph ?? p?.phoneme ?? "";
        const sc =
          typeof p?.score === "number"
            ? p.score
            : typeof p?.accuracy === "number"
            ? p.accuracy
            : typeof p?.accuracyScore === "number"
            ? p.accuracyScore / 100
            : null;
        if (ph && sc != null) acc.push({ ph, sc });
      }
    }
    return acc.sort((a, b) => a.sc - b.sc).slice(0, 5);
  }, [words]);

  const Chip = ({ label, score01 }) => {
    const color = scoreToColor01(score01);
    return (
      <span
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          background: `${color}22`,
          border: `1px solid ${color}44`,
          color,
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {label} {score01 != null ? ` ${(score01 * 100).toFixed(0)}%` : ""}
      </span>
    );
  };

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3>Phoneme feedback</h3>

      {/* Transcript – reference text for comparison */}
      {result.transcript ? (
        <div style={{ marginBottom: 8 }}>
          <strong>Transcript:</strong> {result.transcript}
        </div>
      ) : null}

      {/* Big percentage animation */}
      {overall01 != null && (
        <div style={{ margin: "12px 0 4px" }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 44,
              lineHeight: 1,
              letterSpacing: 0.5,
              color: scoreToColor01(overall01),
            }}
          >
            {countVal.toFixed(0)}%
          </div>
          <div style={{ marginTop: 4, color: "#444" }}>
            <strong>Overall:</strong>{" "}
            <span style={{ color: scoreToColor01(overall01), fontWeight: 700 }}>
              {(overall01 * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* Words and phonemes */}
      {words.length === 0 ? (
        <div style={{ color: "#666" }}>No scores received.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
          {words.map((w, i) => {
            const wordText = w.w ?? w.word ?? "";
            const wordScore01 =
              typeof w.score === "number"
                ? w.score
                : typeof w.accuracy === "number"
                ? w.accuracy
                : typeof w.accuracyScore === "number"
                ? w.accuracyScore / 100
                : null;

            const phs = Array.isArray(w.phonemes) ? w.phonemes : [];
            const barColor = scoreToColor01(wordScore01 ?? 0);

            return (
              <li key={`${wordText}-${i}`} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  {wordText || <em>(empty word)</em>}{" "}
                  {wordScore01 != null && (
                    <span style={{ fontWeight: 500, color: "#555" }}>
                      — {(wordScore01 * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {wordScore01 != null && (
                  <div
                    style={{
                      height: 8,
                      background: "#eef2f7",
                      borderRadius: 6,
                      overflow: "hidden",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(0, Math.min(1, wordScore01)) * 100}%`,
                        height: "100%",
                        background: barColor,
                        transition: "width 500ms ease",
                      }}
                    />
                  </div>
                )}

                {phs.length > 0 ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {phs.map((p, j) => {
                      const ph = p.ph ?? p.phoneme ?? "";
                      const sc =
                        typeof p.score === "number"
                          ? p.score
                          : typeof p.accuracy === "number"
                          ? p.accuracy
                          : typeof p.accuracyScore === "number"
                          ? p.accuracyScore / 100
                          : null;
                      return <Chip key={`${ph}-${j}`} label={`/${ph}/`} score01={sc} />;
                    })}
                  </div>
                ) : (
                  <div style={{ color: "#8a8f99", fontSize: 13 }}>
                    (No phonemes for this word)
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Focus tips for weakest phonemes */}
      {weakestPhonemes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Focus tips</div>
          <ul style={{ margin: 0, paddingLeft: 16, color: "#333" }}>
            {weakestPhonemes.map(({ ph, sc }, idx) => (
              <li key={`${ph}-${idx}`} style={{ marginBottom: 4 }}>
                <strong>/{ph}/</strong> — {(sc * 100).toFixed(0)}%.{" "}
                {phonemeTip(ph)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Optional raw debug data */}
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer" }}>Raw data</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}

/** Short, specific articulation tips for selected phonemes (shown for low scores). */
function phonemeTip(ph) {
  const x = (ph || "").toLowerCase();
  if (x === "r") return "Keep the tongue away from the palate; pull the sound back (/ɹ/).";
  if (x === "l") return "Lift the tongue tip to the ridge behind the teeth; release cleanly.";
  if (x === "t") return "Short, unaspirated stop; tongue behind teeth, quick release.";
  if (x === "d") return "Same position as /t/ but voiced; slight vibration in the throat.";
  if (x === "s") return "Narrow air channel; keep it unvoiced (not like /z/).";
  if (x === "z") return "Like /s/ but voiced; feel gentle vibration.";
  if (x === "ʃ" || x === "sh") return "Round lips slightly; broader air channel than /s/.";
  if (x === "θ") return "Tongue tip lightly between teeth; soft air (English 'th' in 'think').";
  if (x === "ð") return "Like /θ/ but voiced (English 'th' in 'this').";
  if (x === "æ" || x === "ae") return "Open jaw a bit more; tongue low and forward.";
  if (x === "ɑ" || x === "ah") return "Open back of tongue; jaw slightly down, not too rounded.";
  if (x === "ɔ" || x === "aw") return "Slight lip rounding; back of tongue raised.";
  if (x === "u" || x === "uw") return "Round lips clearly; keep tongue back.";
  if (x === "ɪ" || x === "ih") return "Jaw nearly closed; tongue slightly forward, relaxed lips.";
  if (x === "i" || x === "iy") return "Smile slightly; high front tongue, narrow jaw opening.";
  return "Practice the sound slowly in isolation, then say the word again focusing on tongue and airflow.";
}
