// frontend/src/components/PhonemeFeedback.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

console.log("PF LIVE v17", import.meta?.url);

/* ---------- helpers ---------- */
function scoreToColor01(s) {
  const x = Math.max(0, Math.min(1, Number(s) || 0));
  return `hsl(${x * 120}deg 75% 45%)`;
}
function to01(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  return n <= 1 ? Math.max(0, Math.min(1, n)) : Math.max(0, Math.min(1, n / 100));
}
const pct = (x01) => (x01 == null ? "–" : `${Math.round(x01 * 100)}%`);

function useCountUp(target, ms = 900) {
  const [val, setVal] = useState(0);
  const startRef = useRef(null);
  useEffect(() => {
    if (typeof target !== "number") return;
    let raf;
    const tick = (t) => {
      if (startRef.current == null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / ms);
      setVal(target * p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setVal(0);
    startRef.current = null;
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}

function readPhoneme(o = {}) {
  const letters = o.spelling ?? o.letters ?? o.grapheme ?? o.text ?? "";
  const sym = o.phoneme ?? o.ph ?? o.phone ?? o.sound ?? o.ipa ?? o.symbol ?? "";
  const like =
    o.sound_like ?? o.soundLike ?? o.like ?? o.detected ?? o.detected_phoneme ??
    o.recognized ?? o.recognized_phoneme ?? null;
  const s01 = to01(
    o.pronunciation ?? o.accuracy_score ?? o.pronunciation_score ?? o.score ?? o.accuracy
  );
  const stressMark = !!(o.stress_mark ?? o.primary_stress ?? o.stress);
  return { letters, sym, like, s01, stressMark };
}

function Meta({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 min-w-[90px]">
      <div className="text-[11px] text-slate-500 mb-0.5">{label}</div>
      <div className="font-bold text-slate-900">{value ?? "–"}</div>
    </div>
  );
}

/** Heuristisk split i grafemer */
function splitGraphemes(word = "") {
  const w = (word || "").toLowerCase();
  if (!w) return [];
  const patterns = [
    "tch","dge","tion","sion",
    "sch","scr","shr","spl","spr","str","thr",
    "qu","kn","wr","gh","ph","wh","ch","sh","th","ng","ck",
    "ee","oo","ai","ay","au","aw","ou","ow","oi","oy","ea","ie","ei"
  ].sort((a,b)=>b.length-a.length);

  const chunks = [];
  for (let i = 0; i < w.length; ) {
    let m = null;
    for (const p of patterns) { if (w.startsWith(p, i)) { m = p; break; } }
    if (m) { chunks.push(word.slice(i, i+m.length)); i += m.length; }
    else { chunks.push(word[i]); i += 1; }
  }
  return chunks;
}

/** Justér grafemer så #chunks ≈ #phonemer (fx “knife” → [“kn”, “i”, “fe”]) */
function alignToPhonemes(word = "", phCount = 0) {
  let chunks = splitGraphemes(word);
  if (phCount <= 0) return chunks;

  while (chunks.length > phCount) {
    if (chunks.length <= 1) break;
    if (chunks.length % 2 === 0) {
      chunks.splice(0, 2, chunks[0] + chunks[1]); // merge start
    } else {
      const n = chunks.length;
      chunks.splice(n - 2, 2, chunks[n - 2] + chunks[n - 1]); // merge slut
    }
  }
  while (chunks.length < phCount && chunks.length > 0) {
    const last = chunks.pop();
    if (!last || last.length <= 1) { chunks.push(last || ""); break; }
    const letters = last.split("");
    for (let i = 0; i < letters.length - 1; i++) chunks.push(letters[i]);
    chunks.push(letters[letters.length - 1]);
  }
  return chunks;
}

/* ----- colored word / IPA helpers ----- */
function coloredGraphemesOfWord(w) {
  const phs = Array.isArray(w?.phonemes) ? w.phonemes : [];
  const wordText = w?.word ?? w?.w ?? "";
  if (!phs.length) return <span style={{ color: "#111" }}>{wordText}</span>;

  const everyMissing = phs.every((p) => !readPhoneme(p).letters);
  if (everyMissing) {
    const avg = phs.reduce((s, p) => s + (readPhoneme(p).s01 ?? 0), 0) / phs.length || 0;
    return <span style={{ color: scoreToColor01(avg) }}>{wordText}</span>;
  }
  return phs.map((p, i) => {
    const { letters, s01 } = readPhoneme(p);
    return (
      <span key={`gw-${i}`} style={{ color: scoreToColor01(s01 ?? 0) }}>
        {letters || ""}
      </span>
    );
  });
}
function coloredIPAOfWord(w) {
  const phs = Array.isArray(w?.phonemes) ? w.phonemes : [];
  return phs.map((p, i) => {
    const { sym, s01 } = readPhoneme(p);
    return (
      <span key={`gi-${i}`} style={{ color: scoreToColor01(s01 ?? 0), marginRight: 2 }}>
        {sym || ""}
      </span>
    );
  });
}

/* ---------- component ---------- */
export default function PhonemeFeedback({ result }) {
  if (!result) return null;

  const apiErr =
    result.error || result.errId ||
    (result._debug && (result._debug.error || result._debug.errId));
  if (apiErr) {
    return (
      <div className="panel mt-4">
        <h3>Feedback</h3>
        <div style={{ color: "crimson" }}>{String(apiErr)}</div>
      </div>
    );
  }

  const recognition = result.recognition ?? result.transcript ?? "";
  const words = Array.isArray(result.words) ? result.words : [];
  const targetSentence =
    result.target || result.reference || result.text || result.refText || "";

  const isSentence =
    (Array.isArray(words) && words.length >= 2) ||
    (typeof recognition === "string" && /\s/.test(recognition.trim()));

  const overall01 = to01(result.overall ?? result.pronunciation ?? result.overallAccuracy);
  const countVal = useCountUp(overall01 != null ? overall01 * 100 : 0);

  const integrity = result.integrity ?? null;
  const fluency = result.fluency ?? null;
  const rhythm = result.rhythm ?? null;
  const speed = result.speed ?? null;
  const pauseCount = result.pause_count ?? null;
  const durationStr =
    result.duration ??
    (result.numeric_duration != null ? Number(result.numeric_duration).toFixed(3) : null);
  const rearTone = result.rear_tone ?? null;

  // one word
  const oneWord = !isSentence && words.length === 1 ? words[0] : null;
  const wordText = oneWord?.word ?? oneWord?.w ?? "";
  const wordPhs = oneWord ? (Array.isArray(oneWord.phonemes) ? oneWord.phonemes : []) : [];
  const spellingArr = useMemo(
    () => alignToPhonemes(wordText, wordPhs.length),
    [wordText, wordPhs.length]
  );

  const coloredLetters = wordPhs.map((p, i) => {
    const { letters, s01 } = readPhoneme(p);
    const text = (letters && String(letters)) || spellingArr[i] || "";
    return (
      <span key={`L${i}`} style={{ color: scoreToColor01(s01 ?? 0), marginRight: 4 }}>
        {text}
      </span>
    );
  });
  const coloredIPA = wordPhs.map((p, i) => {
    const { sym, s01 } = readPhoneme(p);
    return (
      <span key={`I${i}`} style={{ color: scoreToColor01(s01 ?? 0), marginRight: 2 }}>
        {sym || ""}
      </span>
    );
  });

  const stressMarks = wordPhs.some(p => readPhoneme(p).stressMark)
    ? "/" + wordPhs.map(p => (readPhoneme(p).stressMark ? "ˈ" : "")).join("") + "/"
    : null;

  const wordStressMessage =
    result.word_stress_message ?? result.wordStressMessage ?? result.stress?.message ?? null;

  return (
    <div className="panel mt-4">
      <h3 className="mb-1">Feedback</h3>

      {/* Stor % (uden “Overall: …”) */}
      {overall01 != null && (
        <div className="my-2">
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
        </div>
      )}

      {/* ===== SÆTNING ===== */}
      {isSentence && (
        <>
          {targetSentence && (
            <div className="mb-1 text-slate-800 font-semibold">{targetSentence}</div>
          )}

          <div className="mt-1 mb-2 text-[26px] leading-[1.25] font-extrabold">
            {words.map((w, wi) => (
              <span key={`w-${wi}`} className="mr-2">
                {coloredGraphemesOfWord(w)}
              </span>
            ))}
          </div>

          <div className="mt-1 mb-3 text-[22px] font-semibold">
            <span className="text-slate-700 mr-1">/</span>
            {words.map((w, wi) => (
              <span key={`ipa-${wi}`} className="mr-2">
                {coloredIPAOfWord(w)}
              </span>
            ))}
            <span className="text-slate-700 ml-1">/</span>
          </div>

          {/* Meta-kort */}
          <div className="flex flex-wrap gap-2 my-3">
            <Meta label="Integrity" value={integrity != null ? Math.round(integrity) : "–"} />
            <Meta label="Fluency" value={fluency != null ? Math.round(fluency) : "–"} />
            <Meta label="Rhythm" value={rhythm != null ? Math.round(rhythm) : "–"} />
            <Meta label="Speed (wpm)" value={speed != null ? Math.round(speed) : "–"} />
            <Meta label="Pauses" value={pauseCount ?? "–"} />
            <Meta label="Duration" value={durationStr ?? "–"} />
          </div>

          {/* Enkel pr.-ord nedbrydning: BAR + fonemchips */}
          <ul className="list-none p-0 m-0 mt-2">
            {words.map((w, i) => {
              const wText = w.word ?? w.w ?? "";
              const w01 = to01(
                w?.scores?.overall ?? w?.overall ?? w?.pronunciation ?? w?.accuracy ?? w?.accuracyScore
              );
              const phs = Array.isArray(w.phonemes) ? w.phonemes : [];
              const color = scoreToColor01(w01 ?? 0);

              return (
                <li key={`${wText}-${i}`} className="mb-3">
                  <div className="font-bold mb-1">
                    {wText || <em>(empty word)</em>}{" "}
                    {w01 != null && <span className="font-medium text-slate-600">— {pct(w01)}</span>}
                  </div>

                  {w01 != null && (
                    <div className="h-2 bg-slate-100 rounded-md overflow-hidden mb-2">
                      <div
                        className="h-full transition-[width] ease-out duration-500"
                        style={{ width: `${Math.max(0, Math.min(1, w01)) * 100}%`, background: color }}
                      />
                    </div>
                  )}

                  {phs.length ? (
                    <div className="flex flex-wrap gap-2">
                      {phs.map((p, j) => {
                        const { sym, s01 } = readPhoneme(p);
                        const c = scoreToColor01(s01 ?? 0);
                        return (
                          <span
                            key={`${sym}-${j}`}
                            className="px-2 py-1 rounded-full border"
                            style={{
                              color: c,
                              borderColor: `${c}66`,
                              background: `${c}14`,
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            /{sym}/ {s01 != null ? `${Math.round(s01 * 100)}%` : ""}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-sm">(No phonemes for this word)</div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Tone nederst */}
          {rearTone ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 mt-4">
              <div className="font-medium text-slate-700">
                Tone: You used <strong>{rearTone}</strong> tone at the end of the sentence.
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* ===== ÉT ORD ===== */}
      {oneWord && (
        <>
          <div className="mt-1 mb-0.5">
            <div className="text-[40px] font-extrabold leading-none tracking-wide">
              {coloredLetters}
            </div>
            {wordPhs.length > 0 && (
              <div className="mt-1 text-[28px] font-semibold">
                <span className="text-slate-700 mr-1">/</span>
                {coloredIPA}
                <span className="text-slate-700 ml-1">/</span>
              </div>
            )}
          </div>

          {(wordStressMessage || stressMarks) && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 mt-3 mb-2">
              {wordStressMessage ? (
                <div className="font-medium text-slate-700">{wordStressMessage}</div>
              ) : (
                <div className="font-semibold text-slate-700">
                  Word stress: <code className="font-semibold">{stressMarks}</code>{" "}
                  <span className="text-slate-500">(reference stress marks)</span>
                </div>
              )}
            </div>
          )}

          {/* Per-phoneme tabel for ét ord */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden mt-3">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
              Word-level Evaluation Result
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="text-slate-500 text-sm">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2">Spelling</th>
                    <th className="px-4 py-2">Sound</th>
                    <th className="px-4 py-2">Quality</th>
                    <th className="px-4 py-2">Sound like</th>
                    <th className="px-4 py-2">Feedback</th>
                  </tr>
                </thead>
                <tbody className="text-[15px]">
                  {wordPhs.map((p, i) => {
                    const { letters, sym, like, s01 } = readPhoneme(p);
                    const spellingFallback = alignToPhonemes(wordText, wordPhs.length)[i] || "—";
                    const displayGrapheme = (letters && String(letters)) || spellingFallback;
                    const qualityBadge = (
                      <span className="inline-block rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[13px] font-semibold text-green-700">
                        {pct(s01)}
                      </span>
                    );
                    const feedbackText =
                      p.feedback ??
                      p.result ??
                      (like && sym ? (like === sym ? "Sound match" : "Different") : "—");
                    return (
                      <tr key={i} className="border-b last:border-0 border-slate-200">
                        <td className="px-4 py-3 font-semibold text-slate-800">{displayGrapheme}</td>
                        <td className="px-4 py-3 text-slate-800">{sym ? `/${sym}/` : "—"}</td>
                        <td className="px-4 py-3">{qualityBadge}</td>
                        <td className="px-4 py-3 text-slate-800">{like ? `/${like}/` : "—"}</td>
                        <td className="px-4 py-3 text-slate-800">{feedbackText}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
