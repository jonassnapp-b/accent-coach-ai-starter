import React, { useEffect, useRef, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://accent-coach-ai-starter.onrender.com";

export default function App() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [targetPhrase, setTargetPhrase] = useState("The quick brown fox jumps over the lazy dog.");
  const [targetAccent, setTargetAccent] = useState("American");
  const [score, setScore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    return () => { if (audioURL) URL.revokeObjectURL(audioURL); };
  }, [audioURL]);

  async function startRecording() {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setRecording(true);
    } catch (e) {
      setError(e?.message || "Kunne ikke starte optagelse");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }
const API_BASE = import.meta.env.VITE_API_BASE;

  async function scorePronunciation() {
    if (!audioURL) return;
    try {
      setBusy(true);
      setError(null);
      setScore(null);

      const resBlob = await fetch(audioURL).then((r) => r.blob());
      const form = new FormData();
      form.append("audio", resBlob, "sample.webm");
      form.append("targetPhrase", targetPhrase);
      form.append("targetAccent", targetAccent);

      
const res = await fetch(`${API_BASE}/api/score`, {
  method: "POST",
  body: form
});
      if (!res.ok) throw new Error(`API fejl: ${res.status}`);
      const data = await res.json();
      setScore(data);
    } catch (e) {
      setError(e?.message || "Scoring fejlede");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{fontFamily:'system-ui, sans-serif', padding: 24, maxWidth: 800, margin: '0 auto'}}>
      <h1 style={{fontSize: 28, fontWeight: 800, marginBottom: 8}}>Accent Coach AI <span style={{fontSize: 14, fontWeight: 400, color:'#666'}}>MVP</span></h1>
      <p style={{color:'#555'}}>Optag din stemme, sammenlign mod en mål-sætning og få en udtalescore + hints.</p>

      <div style={{display:'grid', gap: 12, marginTop: 16, marginBottom: 16}}>
        <label>
          <div style={{fontSize:12,color:'#444'}}>Mål-sætning</div>
          <textarea rows="2" value={targetPhrase} onChange={(e)=>setTargetPhrase(e.target.value)} style={{width:'100%', padding:12, borderRadius:12, border:'1px solid #ddd'}} />
        </label>
        <label>
          <div style={{fontSize:12,color:'#444'}}>Mål-accent</div>
          <select value={targetAccent} onChange={(e)=>setTargetAccent(e.target.value)} style={{width:'100%', padding:12, borderRadius:12, border:'1px solid #ddd'}}>
            <option>American</option>
            <option>British</option>
            <option>Australian</option>
            <option>Indian</option>
            <option>Generic</option>
          </select>
        </label>

        <div style={{display:'flex', gap: 8, alignItems:'center'}}>
          {!recording ? (
            <button onClick={startRecording} style={{padding:'8px 14px', borderRadius:12, background:'#000', color:'#fff'}}>🎙️ Start optagelse</button>
          ) : (
            <button onClick={stopRecording} style={{padding:'8px 14px', borderRadius:12, background:'#e11', color:'#fff'}}>⏹️ Stop</button>
          )}
          <button onClick={scorePronunciation} disabled={!audioURL || busy} style={{padding:'8px 14px', borderRadius:12, background:'#4f46e5', color:'#fff', opacity: (!audioURL||busy)?0.6:1}}>
            {busy ? "Analyserer…" : "Analyser udtale"}
          </button>
        </div>

        {audioURL && (
          <div>
            <audio src={audioURL} controls style={{width:'100%'}} />
            <div style={{fontSize:12, color:'#666', marginTop:4}}>Preview af din optagelse</div>
          </div>
        )}
      </div>

      {error && <div style={{background:'#fee2e2', border:'1px solid #fecaca', color:'#991b1b', padding:12, borderRadius:12, marginBottom:12}}>{String(error)}</div>}

      {score && (
        <div style={{border:'1px solid #eee', background:'#fff', padding:16, borderRadius:16}}>
          <div style={{display:'flex', alignItems:'baseline', gap:12}}>
            <div style={{fontSize:36, fontWeight:800}}>{Math.round(score.overall)}</div>
            <div style={{color:'#666'}}>/ 100</div>
          </div>
          <p style={{color:'#555'}}>Samlet udtalescore</p>
          <div style={{display:'grid', gap:8}}>
            {score.words?.map((w, i) => (
              <div key={i} style={{display:'flex', justifyContent:'space-between', border:'1px solid #eee', borderRadius:12, padding:8}}>
                <div style={{fontWeight:600}}>{w.word}</div>
                <div style={{color:'#666'}}>{Math.round(w.score)}/100</div>
              </div>
            ))}
          </div>
          <p style={{fontSize:12, color:'#666', marginTop:8}}>Tip: Fokusér på lave scores først. Gentag mål-sætningen i korte bidder.</p>
        </div>
      )}
    </div>
  );
}
