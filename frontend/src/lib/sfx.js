// src/lib/sfx.js
// Tiny sound engine (Web Audio) – no external files required.
let ctx = null;
let master = null;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6; // default volume (overridden by settings)
    master.connect(ctx.destination);
  }
}

// iOS unlock on first gesture
export function warm() {
  try {
    ensureCtx();
    // Some browsers require a resume() on user gesture
    if (typeof ctx.resume === "function" && ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    o.connect(g); g.connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.01);
  } catch {}
}

export function setVolume(vol01) {
  ensureCtx();
  master.gain.value = Math.max(0, Math.min(1, Number(vol01) || 0));
}

// ----- low-level beep with envelope -----
function beep(freq = 440, t0 = ctx.currentTime, len = 0.18, type = "sine", gain = 0.9) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + len + 0.02);
}

// helpers
const NOTES = {
  C4: 261.63, E4: 329.63, G4: 392.0, C5: 523.25,
  A3: 220.0,  G3: 196.0,  D5: 587.33, E5: 659.25, G5: 783.99,
};

function playSeq(seq, start = ctx.currentTime) {
  let t = start;
  for (const step of seq) {
    const { f, len = 0.16, gap = 0.04, gain = 0.9, type = "sine" } = step;
    beep(f, t, len, type, gain);
    t += len + gap;
  }
}

// ===== Public API =====

// 1) Bright success chime (strength: 1 good, 2 excellent)
export function success({ strength = 1 } = {}) {
  ensureCtx();
  const variants = [
    [{ f: NOTES.C4 }, { f: NOTES.E4 }, { f: NOTES.G4 }, { f: NOTES.C5, gain: 1 }],
    [{ f: NOTES.E4 }, { f: NOTES.G4 }, { f: NOTES.C5 }],
    [{ f: NOTES.C4, len: 0.12 }, { f: NOTES.E4, len: 0.12 }, { f: NOTES.G4, len: 0.14 }, { f: NOTES.C5, len: 0.18 }],
  ];
  const pick = variants[Math.floor(Math.random() * variants.length)];
  const louder = pick.map(s => ({ ...s, gain: (s.gain ?? 0.9) * (strength === 2 ? 1.12 : 0.88) }));
  playSeq(louder);
}

// 2) Very soft negative cue
export function softFail() {
  ensureCtx();
  playSeq(
    [
      { f: NOTES.A3, len: 0.12, gain: 0.35, type: "sine" },
      { f: NOTES.G3, len: 0.14, gain: 0.28, type: "sine" },
    ]
  );
}

// 3) Streak/daily-goal fanfare
export function fanfare() {
  ensureCtx();
  playSeq(
    [
      { f: NOTES.G4, len: 0.12, gain: 0.9 },
      { f: NOTES.C5, len: 0.12, gain: 0.95 },
      { f: NOTES.E5, len: 0.12, gain: 1.0 },
      { f: NOTES.G5, len: 0.18, gain: 1.0 },
    ]
  );
}

// 4) Optional short haptic (web + Capacitor friendly)
export function hapticShort() {
  try {
    if ("vibrate" in navigator) navigator.vibrate(25);
    // If using Capacitor, you can bridge: Haptics.impact({ style: "Medium" })
  } catch {}
}
