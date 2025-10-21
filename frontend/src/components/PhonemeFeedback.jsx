// src/components/PhonemeFeedback.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/** Map score 0–1 til en glidende farve fra rød→gul→grøn (HSL). */
function scoreToColor01(s) {
  const clamped = Math.max(0, Math.min(1, Number(s) || 0));
  const hue = clamped * 120;          // 0=red, 120=green
  const sat = 75;                     // %
  const light = 45;                   // %
  return `hsl(${hue}deg ${sat}% ${light}%)`;
}

/** Simpel tælle-animation (0 → target) til “stor procent”. */
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

  // Fejl fra API
  if (result.error) {
    return (
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Phoneme feedback</h3>
        <div style={{ color: "crimson" }}>{String(result.error)}</div>
        {result._debug ? (
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>
            {JSON.stringify(result._debug, null, 2)}
          </pre>
        ) : null}
      </div>
    );
  }

  const words = Array.isArray(result.words) ? result.words : [];

  // overall (0–1) – vi understøtter også overallAccuracy (0–100) som alias
  const overall01 = typeof result.overall === "number"
    ? result.overall
    : (typeof result.overallAccuracy === "number"
        ? result.overallAccuracy / 100
        : null);

  // stor tælle-procent
  const countVal = useCountUp(overall01 != null ? overall01 * 100 : 0);

  // find “svageste” fonemer på tværs af ord (reel data fra Azure)
  const weakestPhonemes = useMemo(() => {
    const acc = [];
    for (const w of words) {
      if (!Array.isArray(w?.phonemes)) continue;
      for (const p of w.phonemes) {
        const ph = p?.ph ?? p?.phoneme ?? "";
        const sc = typeof p?.score === "number"
          ? p.score
          : (typeof p?.accuracy === "number" ? p.accuracy
             : (typeof p?.accuracyScore === "number" ? p.accuracyScore / 100 : null));
        if (ph && sc != null) acc.push({ ph, sc });
      }
    }
    // sorter stigende (lavest først), vis top 5
    return acc.sort((a,b) => a.sc - b.sc).slice(0, 5);
  }, [words]);

  // lille funktions-hjælp: vis chip med farve fra spektrum
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
          fontSize: 13
        }}
      >
        {label} {(score01 != null) ? ` ${(score01 * 100).toFixed(0)}%` : ""}
      </span>
    );
  };

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3>Phoneme feedback</h3>

      {/* Transcript – så brugeren ved hvad der blev målt imod */}
      {result.transcript ? (
        <div style={{ marginBottom: 8 }}>
          <strong>Transcript:</strong> {result.transcript}
        </div>
      ) : null}

      {/* Stor procent animation (tegnefilmsagtig) */}
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
          {/* Mindre tekst-version under, “fader” naturligt ind */}
          <div style={{ marginTop: 4, color: "#444" }}>
            <strong>Overall:</strong>{" "}
            <span style={{ color: scoreToColor01(overall01), fontWeight: 700 }}>
              {(overall01 * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* SNR-hint, kun hvis Azure har leveret feltet */}
      {typeof result.snr === "number" && (
        <div style={{ margin: "8px 0 4px", fontSize: 13, color: "#555" }}>
          Mic noise (SNR): <strong>{result.snr.toFixed(1)} dB</strong>{" "}
          {result.snr < 12
            ? "— optag i roligere omgivelser eller tættere på mikrofonen."
            : result.snr < 18
            ? "— acceptabelt, men roligere rum kan hjælpe."
            : "— god optagelseskvalitet."}
        </div>
      )}

      {/* Ord med bar + chips for fonemer (alt fra Azure) */}
      {words.length === 0 ? (
        <div style={{ color: "#666" }}>Ingen scores modtaget.</div>
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
                  {wordText || <em>(tomt ord)</em>}{" "}
                  {wordScore01 != null && (
                    <span style={{ fontWeight: 500, color: "#555" }}>
                      — {(wordScore01 * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Spektrum-bar pr. ord */}
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

                {/* Fonem-chips (reel fonem-accuracy) */}
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
                    (Ingen fonemer for dette ord)
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Korte, datadrevne tips for svageste fonemer (ingen “gæt”) */}
      {weakestPhonemes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Fokus-tips</div>
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

      {/* Valgfri rå data til fejlfinding */}
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer" }}>Rå data</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}

/** Små, præcise artikulations-tips for udvalgte fonemer (vises kun for lavt scorende). */
function phonemeTip(ph) {
  const x = ph.toLowerCase();
  if (x === "r")   return "Hold tungen væk fra ganen; træk lyden i munden (amerikansk /ɹ/).";
  if (x === "l")   return "Løft tungespidsen mod gummen lige bag tænderne; slip ud med klar luft.";
  if (x === "t")   return "Kort, uaspireret luk; tungespids bag tænderne, slip hurtigt.";
  if (x === "d")   return "Samme placering som /t/, men stemt; vibrér svagt i struben.";
  if (x === "s")   return "Smalt luftflow mellem tungespids og tænder; undgå ‘z’-voicing.";
  if (x === "z")   return "Som /s/ men stemt; læg mærke til svag vibration.";
  if (x === "ʃ" || x === "sh") return "Rund læberne let; bredere luftkanal end /s/.";
  if (x === "θ")  return "Tungespids let mellem tænderne; pust blødt (engelsk ‘th’ i ‘think’).";
  if (x === "ð")  return "Som /θ/ men stemt (engelsk ‘th’ i ‘this’).";
  if (x === "æ" || x === "ae") return "Åbn kæben lidt mere; hold tungen lav og fremme.";
  if (x === "ɑ" || x === "ah") return "Åben bagtunge; kæben lidt ned, rund ikke for meget.";
  if (x === "ɔ" || x === "aw") return "Rund læber let; bagtunge løftet.";
  if (x === "u" || x === "uw") return "Rund læberne tydeligt; hold tungen bagtil.";
  if (x === "ɪ" || x === "ih") return "Kæben næsten lukket; tungen lidt fremme, afslap læber.";
  if (x === "i" || x === "iy") return "Smil let; høj fortunge, meget smal kæbeåbning.";
  return "Øv lyden isoleret langsomt, og sig ordet igen med fokus på placering og luftflow.";
}
