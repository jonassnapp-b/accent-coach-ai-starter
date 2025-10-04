import React, { useRef, useState } from "react";

const SAMPLE_URL = "/samples/en-US/quick_brown_fox.mp3";

export default function CompareTab({ userAudioURL }) {
  const sampleRef = useRef(null);
  const userRef = useRef(null);
  const [mix, setMix] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);

  const playBoth = async () => {
    const sample = sampleRef.current;
    const user = userRef.current;
    if (!sample || !user || !userAudioURL) return alert("No audio available");

    sample.volume = 1 - mix / 100;
    user.volume = mix / 100;

    sample.currentTime = 0;
    user.currentTime = 0;

    await sample.play();
    await user.play();

    setIsPlaying(true);

    sample.onended = () => setIsPlaying(false);
  };

  const stopBoth = () => {
    const sample = sampleRef.current;
    const user = userRef.current;
    sample.pause();
    user.pause();
    sample.currentTime = 0;
    user.currentTime = 0;
    setIsPlaying(false);
  };

  return (
    <div style={{ textAlign: "center", marginTop: 20 }}>
      <h2>🎚️ Accent Comparison</h2>
      <p>Blend between the native and your recording.</p>

      <div style={{ margin: "20px 0" }}>
        <input
          type="range"
          min="0"
          max="100"
          value={mix}
          onChange={(e) => setMix(e.target.value)}
        />
        <p>Blend: {mix < 50 ? "Mostly Native" : mix > 50 ? "Mostly You" : "Even Mix"}</p>
      </div>

      <div>
        {!isPlaying ? (
          <button onClick={playBoth}>▶️ Play Comparison</button>
        ) : (
          <button onClick={stopBoth}>⏹️ Stop</button>
        )}
      </div>

      <audio ref={sampleRef} src={SAMPLE_URL} preload="auto" />
      <audio ref={userRef} src={userAudioURL} preload="auto" />
    </div>
  );
}
