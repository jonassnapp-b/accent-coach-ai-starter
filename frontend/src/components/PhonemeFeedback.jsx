// src/components/PhonemeFeedback.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toggleBookmark, isBookmarked } from "../lib/bookmarks.js";
import { useSettings } from "../lib/settings-store.jsx";
import ScoreRing from "./ScoreRing.jsx"; // ⬅️ NY

console.log("PF LIVE v24", import.meta?.url);

/* ---------- helpers ---------- */
function parseDurationToSeconds(val) {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  if (s.includes(":")) {
    const parts = s.split(":").map(Number);
    if (parts.some((n) => !isFinite(n))) return null;
    let sec = 0;
    if (parts.length === 3) { const [hh, mm, ss] = parts; sec = (hh||0)*3600 + (mm||0)*60 + (ss||0); }
    else if (parts.length === 2) { const [mm, ss] = parts; sec = (mm||0)*60 + (ss||0); }
    else { sec = parts[0] || 0; }
    return sec;
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
}
function scoreToColor01(s) { const x = Math.max(0, Math.min(1, Number(s) || 0)); return `hsl(${x*120}deg 75% 45%)`; }
function to01(v) { if (v==null||v==="") return null; const n = Number(v); if(!isFinite(n)) return null; return n<=1 ? Math.max(0,Math.min(1,n)) : Math.max(0,Math.min(1,n/100)); }
const pct = (x01) => (x01 == null ? "–" : `${Math.round(x01 * 100)}%`);

/* --- stress helpers (IPA) --- */
const IPA_VOWELS = /[aeiouyɑæɐɒɔɞɤəɚɝɜɪʊʌɛœø]/i;
const isIpaVowel = (sym="") => IPA_VOWELS.test(sym.replace(/[ˈˌ.ː:‖]/g, ""));
function stressedVowelIndexFromIpa(ipaWord = "") {
  if (!ipaWord) return null;
  const core = String(ipaWord).replace(/^\/|\/$/g, "");
  const pos = core.indexOf("ˈ");
  if (pos < 0) return null;
  const before = core.slice(0, pos);
  return (before.match(IPA_VOWELS) || []).length; // 0-based
}

/* --- mapping --- */
function readPhoneme(o = {}) {
  const letters = o.spelling ?? o.letters ?? o.grapheme ?? o.text ?? "";
  const sym = o.phoneme ?? o.ph ?? o.phone ?? o.sound ?? o.ipa ?? o.symbol ?? "";
  const like =
    o.sound_like ?? o.soundLike ?? o.like ?? o.detected ?? o.detected_phoneme ??
    o.recognized ?? o.recognized_phoneme ?? null;
  const s01 = to01(o.pronunciation ?? o.accuracy_score ?? o.pronunciation_score ?? o.score ?? o.accuracy);
  const stressMark = !!(o.stress_mark ?? o.primary_stress ?? o.stress);
  return { letters, sym, like, s01, stressMark };
}

/* ui helpers */
function Meta({ label, value }) {
  return (
    <div className="rounded-xl" style={{border:'1px solid var(--panel-border)', background:'var(--panel-bg)'}}>
      <div className="px-3 pt-2 text-[11px]" style={{color:'var(--muted)'}}>{label}</div>
      <div className="px-3 pb-2 font-bold" style={{color:'var(--panel-text)'}}>{value ?? "–"}</div>
    </div>
  );
}

/** grapheme helpers */
function splitGraphemes(word = "") {
  const w = (word || "").toLowerCase(); if (!w) return [];
  const patterns = ["tch","dge","tion","sion","sch","scr","shr","spl","spr","str","thr","qu","kn","wr","gh","ph","wh","ch","sh","th","ng","ck","ee","oo","ai","ay","au","aw","ou","ow","oi","oy","ea","ie","ei"].sort((a,b)=>b.length-a.length);
  const chunks = [];
  for (let i=0;i<w.length;){ let m=null; for (const p of patterns){ if(w.startsWith(p,i)){m=p;break;} }
    if (m){ chunks.push(word.slice(i,i+m.length)); i+=m.length; } else { chunks.push(word[i]); i+=1; } }
  return chunks;
}
function alignToPhonemes(word = "", phCount = 0) {
  let chunks = splitGraphemes(word); if (phCount <= 0) return chunks;
  while (chunks.length > phCount) { if (chunks.length <= 1) break; if (chunks.length % 2 === 0) chunks.splice(0,2,chunks[0]+chunks[1]); else { const n=chunks.length; chunks.splice(n-2,2,chunks[n-2]+chunks[n-1]); } }
  while (chunks.length < phCount && chunks.length > 0) {
    const last = chunks.pop(); if (!last || last.length <= 1) { chunks.push(last || ""); break; }
    const letters = last.split(""); for (let i=0;i<letters.length-1;i++) chunks.push(letters[i]); chunks.push(letters[letters.length-1]);
  }
  return chunks;
}

/* colorized word/IPA */
function coloredGraphemesOfWord(w) {
  const phs = Array.isArray(w?.phonemes) ? w.phonemes : [];
  const wordText = w?.word ?? w?.w ?? "";
  if (!phs.length) return <span style={{ color: "var(--panel-text)" }}>{wordText}</span>;
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
  const { settings } = useSettings();
  if (!result) return null;

  const apiErr = result.error || result.errId || (result._debug && (result._debug.error || result._debug.errId));
  if (apiErr) {
    return (
      <div className="rounded-[24px] p-5 sm:p-6 mt-4" style={{background:'var(--panel-bg)', color:'var(--panel-text)'}}>
        <h3 className="mb-1 font-semibold">Feedback</h3>
        <div style={{color:'#e5484d'}}>{String(apiErr)}</div>
      </div>
    );
  }

  const recognition = result.recognition ?? result.transcript ?? "";
  const words = Array.isArray(result.words) ? result.words : [];
  const targetSentenceRaw = result.target || result.reference || result.text || result.refText || "";
  const wordsJoined = Array.isArray(words) ? words.map(w => (w.word ?? w.w ?? "")).join(" ").trim() : "";
  const displaySentence = (targetSentenceRaw || "").trim() || (recognition || "").trim() || wordsJoined;

  const isSentence = (Array.isArray(words) && words.length >= 2) || (typeof displaySentence === "string" && /\s/.test(displaySentence));
  const targetSentence = displaySentence;

  const overall01 = to01(result.overall ?? result.pronunciation ?? result.overallAccuracy);

  const integrity = result.integrity ?? null;
  const fluency    = result.fluency ?? null;
  const rhythm     = result.rhythm ?? null;
  const speed      = result.speed ?? null;
  const pauseCount = result.pause_count ?? null;

  const durationSec = (() => {
    if (result.duration_ms != null && isFinite(Number(result.duration_ms))) return Number(result.duration_ms) / 1000;
    if (result.numeric_duration != null && isFinite(Number(result.numeric_duration))) return Number(result.numeric_duration);
    if (result.duration != null) return parseDurationToSeconds(result.duration);
    return null;
  })();
  const durationDisplay = durationSec == null ? "–" : (durationSec >= 10 ? durationSec.toFixed(1) : durationSec.toFixed(2)) + " s";

  const rearTone = result.rear_tone ?? null;

  // one word
  const oneWord   = !isSentence && words.length === 1 ? words[0] : null;
  const wordText  = oneWord?.word ?? oneWord?.w ?? "";
  const wordPhs   = oneWord ? (Array.isArray(oneWord.phonemes) ? oneWord.phonemes : []) : [];
  const spellingArr = useMemo(() => alignToPhonemes(wordText, wordPhs.length), [wordText, wordPhs.length]);

  const coloredLetters = wordPhs.map((p, i) => {
    const { letters, s01 } = readPhoneme(p);
    const text = (letters && String(letters)) || spellingArr[i] || "";
    return <span key={`L${i}`} style={{ color: scoreToColor01(s01 ?? 0), marginRight: 4 }}>{text}</span>;
  });
  const coloredIPA = wordPhs.map((p, i) => {
    const { sym, s01 } = readPhoneme(p);
    return <span key={`I${i}`} style={{ color: scoreToColor01(s01 ?? 0), marginRight: 2 }}>{sym || ""}</span>;
  });

  function ipaOfWord(phs = []) {
    const parts = (Array.isArray(phs) ? phs : []).map((p) => (p?.phoneme || p?.ph || p?.sound || p?.ipa || "")).filter(Boolean);
    return parts.length ? `/${parts.join("")}/` : "";
  }
  const ipaWord = ipaOfWord(wordPhs);
  const ipaSentence = `/${(Array.isArray(words) ? words : []).map((w) => ipaOfWord(w?.phonemes)).join(" ").replace(/\s+/g, " ").trim()}/`.replace(/^\/\//, "/");

  const targetText = oneWord ? (wordText || "") : (targetSentence || "");
  const targetIpa  = oneWord ? ipaWord : ipaSentence;
  const targetScorePct = overall01 != null ? Math.round(overall01 * 100) : null;

  const [booked, setBooked] = useState(isBookmarked(targetText));
  useEffect(() => { setBooked(isBookmarked(targetText)); }, [targetText]);

  function onToggleBookmark() {
    if (!targetText) return;
    toggleBookmark({ text: targetText, ipa: targetIpa, score: targetScorePct, type: oneWord ? "word" : "sentence", createdAt: Date.now() });
    setBooked(isBookmarked(targetText));
  }

  /* audio buttons */
  const userAudioUrl =
    result.userAudioUrl || result.audioUrl || result.recordingUrl || result?.audio?.url || result?.userAudio?.url || null;

  function playRecording() {
    if (!userAudioUrl) return;
    try { new Audio(userAudioUrl).play(); } catch {}
  }
  function playTTS() {
    const text = targetText?.trim(); if (!text) return;
    try {
      const accentRaw = String(result.accent || result.accent_code || result.accentCode || settings.accentDefault || "").toLowerCase();
      const useGB = settings.accentDefault === "en_br" || accentRaw.includes("uk") || accentRaw.includes("brit") || accentRaw === "en_br";
      const u = new SpeechSynthesisUtterance(text);
      u.lang = useGB ? "en-GB" : "en-US";
      u.rate = settings.ttsRate ?? 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }

  // stress
  const stressedVowelIdx = oneWord ? stressedVowelIndexFromIpa(ipaWord) : null;
  const hasStress = oneWord
    ? wordPhs.some((p) => {
        const base = readPhoneme(p);
        if (base.stressMark) return true;
        if (!isIpaVowel(base.sym) || stressedVowelIdx == null) return false;
        let seen = -1, my = -1;
        for (let k = 0; k < wordPhs.length; k++) {
          const symK = readPhoneme(wordPhs[k]).sym;
          if (isIpaVowel(symK)) { seen++; if (k === wordPhs.indexOf(p)) my = seen; }
        }
        return my === stressedVowelIdx;
      })
    : false;

  const showIPA           = !!settings?.showIPA;
  const showPhonemeTable  = !!settings?.showPhonemeTable;
  const showStressTips    = !!settings?.showStressTips && hasStress;

  return (
    <div className="rounded-[24px] p-5 sm:p-6 mt-4 relative shadow-xl"
         style={{ background: "var(--panel-bg)", color: "var(--panel-text)", border: "1px solid var(--panel-border)" }}>
      {overall01 != null && targetText && (
        <button
          onClick={onToggleBookmark}
          className={["absolute right-3 top-3 p-2 rounded-xl transition",
            booked ? "bg-amber-300/20 text-amber-300" : "bg-white/10 hover:bg-white/20"].join(" ")}
          title={booked ? "Remove bookmark" : "Bookmark"}
        >
          {booked ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
        </button>
      )}

      <h3 className="mb-1 font-semibold">Feedback</h3>

      {overall01 != null && (
        <>
          {/* NEW: Medalized score ring header */}
          <div className="flex items-center justify-between mb-3">
            <ScoreRing score={Math.round(overall01 * 100)} size={72} />
          </div>

          {/* Progress rows */}
          <div>
            {[
              ["Pronunciation", to01(result?.pronunciation ?? result?.overall) ?? overall01],
              ["Fluency",       to01(result?.fluency)],
              ["Intonation",    to01(result?.intonation ?? result?.rhythm)],
            ].filter(([,v]) => v != null).map(([label, v]) => {
              const p = Math.round(v*100);
              const cls = p >= 90 ? "fill-good" : p >= 70 ? "fill-okay" : "fill-bad";
              return (
                <div className="progress-row" key={label}>
                  <div className="progress-label">{label}</div>
                  <div className="progress-track">
                    <div className={`progress-fill ${cls}`} style={{width: `${Math.max(0, Math.min(100, p))}%`}} />
                  </div>
                  <div style={{width:36, textAlign:"right"}}>{p}%</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="flex items-center gap-3 mt-2 mb-4">
        <button
          onClick={playRecording}
          disabled={!userAudioUrl}
          className={["inline-flex items-center gap-2 px-3 py-2 rounded-lg",
            userAudioUrl ? "bg-white/10 hover:bg-white/20" : "bg-white/5 opacity-60 cursor-not-allowed"].join(" ")}
          title={userAudioUrl ? "Play your recording" : "No recording available"}
        >
          <span role="img" aria-label="microphone">🎙️</span>
          <span className="text-sm font-medium">Your recording</span>
        </button>
        <button onClick={playTTS} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20">
          <span role="img" aria-label="speaker">🔊</span>
          <span className="text-sm font-medium">Native</span>
        </button>
      </div>

      {/* ===== SENTENCE ===== */}
      {isSentence && (
        <>
          {targetSentence && <div className="mb-1 font-semibold" style={{color:'var(--panel-text)'}}>{targetSentence}</div>}

          <div className="mt-1 mb-2 text-[26px] leading-[1.25] font-extrabold">
            {words.map((w, wi) => <span key={`w-${wi}`} className="mr-2">{coloredGraphemesOfWord(w)}</span>)}
          </div>

          {showIPA && (
            <div className="mt-1 mb-3 text-[22px] font-semibold" style={{color:'var(--panel-text)'}}>
              <span style={{color:'var(--muted)'}}>/</span>
              {words.map((w, wi) => <span key={`ipa-${wi}`} className="mr-2">{coloredIPAOfWord(w)}</span>)}
              <span style={{color:'var(--muted)'}}>/</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 my-3">
            <Meta label="Integrity" value={integrity != null ? Math.round(integrity) : "–"} />
            <Meta label="Fluency"   value={fluency   != null ? Math.round(fluency)   : "–"} />
            <Meta label="Rhythm"    value={rhythm    != null ? Math.round(rhythm)    : "–"} />
            <Meta label="Speed (wpm)" value={speed  != null ? Math.round(speed)     : "–"} />
            <Meta label="Pauses"    value={pauseCount ?? "–"} />
            <Meta label="Duration"  value={durationDisplay} />
          </div>

          <ul className="list-none p-0 m-0 mt-2">
            {words.map((w, i) => {
              const wText = w.word ?? w.w ?? "";
              const w01 = to01(w?.scores?.overall ?? w?.overall ?? w?.pronunciation ?? w?.accuracy ?? w?.accuracyScore);
              const phs = Array.isArray(w.phonemes) ? w.phonemes : [];
              const color = scoreToColor01(w01 ?? 0);
              return (
                <li key={`${wText}-${i}`} className="mb-3">
                  <div className="font-bold mb-1">
                    {wText || <em>(empty word)</em>}{" "}
                    {w01 != null && <span style={{color:'var(--muted)'}}>— {pct(w01)}</span>}
                  </div>

                  {w01 != null && (
                    <div className="h-2 rounded-md overflow-hidden mb-2" style={{background:'rgba(255,255,255,0.1)'}}>
                      <div className="h-full transition-[width] ease-out duration-500" style={{ width: `${Math.max(0, Math.min(1, w01)) * 100}%`, background: color }} />
                    </div>
                  )}

                  {phs.length ? (
                    <div className="flex flex-wrap gap-2">
                      {phs.map((p, j) => {
                        const { sym, s01 } = readPhoneme(p);
                        const c = scoreToColor01(s01 ?? 0);
                        return (
                          <span key={`${sym}-${j}`} className="px-2 py-1 rounded-full border"
                                style={{ color: c, borderColor: `${c}66`, background: `${c}14`, fontWeight: 700, fontSize: 13 }}>
                            /{sym}/ {s01 != null ? `${Math.round(s01 * 100)}%` : ""}
                          </span>
                        );
                      })}
                    </div>
                  ) : <div className="text-sm" style={{color:'var(--muted)'}}>(No phonemes for this word)</div>}
                </li>
              );
            })}
          </ul>

          {rearTone ? (
            <div className="rounded-2xl px-4 py-3 mt-4"
                 style={{border:'1px solid rgba(56,189,248,.3)', background:'rgba(56,189,248,.1)'}}>
              <div className="font-medium">Tone: You used <strong>{rearTone}</strong> tone at the end of the sentence.</div>
            </div>
          ) : null}
        </>
      )}

      {/* ===== ONE WORD ===== */}
      {oneWord && (
        <>
          <div className="mt-1 mb-0.5">
            <div className="text-[40px] font-extrabold leading-none tracking-wide">{coloredLetters}</div>
            {showIPA && wordPhs.length > 0 && (
              <div className="mt-1 text-[28px] font-semibold">
                <span style={{color:'var(--muted)'}}>/</span>
                {coloredIPA}
                <span style={{color:'var(--muted)'}}>/</span>
              </div>
            )}
          </div>

          {/* Word stress ONLY if we found any */}
          {showStressTips && (
            <div className="rounded-2xl px-4 py-3 mt-3 mb-2"
                 style={{border:'1px solid rgba(56,189,248,.3)', background:'rgba(56,189,248,.1)'}}>
              <div className="font-semibold mb-1 text-lg">Word stress</div>
              <p className="text-sm" style={{color:'var(--muted)'}}>
                The highlighted sounds are the most emphasized when this word is spoken correctly.
              </p>
              <div className="flex flex-wrap gap-2">
                {wordPhs.map((p, i) => {
                  const base = readPhoneme(p);
                  let isStressed = !!base.stressMark;
                  if (!isStressed && isIpaVowel(base.sym) && stressedVowelIdx != null) {
                    let seen = -1, myVowelOrder = -1;
                    for (let k=0;k<wordPhs.length;k++){
                      const symK = readPhoneme(wordPhs[k]).sym;
                      if (isIpaVowel(symK)) { seen++; if (k===i) myVowelOrder = seen; }
                    }
                    if (myVowelOrder === stressedVowelIdx) isStressed = true;
                  }
                  const display = base.sym || "·";
                  return (
                    <span key={i}
                      className={"px-3 py-1 rounded-full text-sm font-semibold " +
                        (isStressed ? "bg-amber-400/20 text-amber-300 border border-amber-300/40"
                                    : "bg-white/10 text-white/70 border border-white/10")}>
                      {isStressed ? `🔸 ${display}` : display}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {showPhonemeTable && (
            <div className="rounded-2xl overflow-hidden mt-3" style={{border:'1px solid var(--panel-border)'}}>
              <div className="px-4 py-3" style={{borderBottom:'1px solid var(--panel-border)', background:'rgba(255,255,255,0.05)'}}>
                Word-level Evaluation Result
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="text-sm" style={{color:'var(--muted)'}}>
                    <tr style={{borderBottom:'1px solid var(--panel-border)'}}>
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
                        <span className="inline-block rounded-full"
                              style={{border:'1px solid rgba(74,222,128,.4)', background:'rgba(74,222,128,.1)', color:'#86efac', padding:'4px 10px', fontWeight:600, fontSize:13}}>
                          {pct(s01)}
                        </span>
                      );
                      const feedbackText = p.feedback ?? p.result ?? (like && sym ? (like === sym ? "Sound match" : "Different") : "—");
                      return (
                        <tr key={i} style={{borderBottom:'1px solid var(--panel-border)'}}>
                          <td className="px-4 py-3 font-semibold">{displayGrapheme}</td>
                          <td className="px-4 py-3">{sym ? `/${sym}/` : "—"}</td>
                          <td className="px-4 py-3">{qualityBadge}</td>
                          <td className="px-4 py-3" style={{color:'var(--muted)'}}>{like ? `/${like}/` : "—"}</td>
                          <td className="px-4 py-3" style={{color:'var(--muted)'}}>{feedbackText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}