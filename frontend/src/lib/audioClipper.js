// frontend/src/lib/audioClipper.js
let ctx = null;
const bufferCache = new Map(); // url -> AudioBuffer

// Keep a handle to stop whatever is currently playing (prevents overlap + harsh stacking)
let currentStop = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

async function loadBuffer(url) {
  if (bufferCache.has(url)) return bufferCache.get(url);

  const c = getCtx();
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  const buf = await c.decodeAudioData(arr.slice(0));
  bufferCache.set(url, buf);
  return buf;
}

/**
 * Play a segment [startSec, endSec] from an audio URL.
 * Uses WebAudio so timing is precise.
 *
 * Improvements for "harsh" sound:
 * - stops previous playback (no overlap clicks)
 * - adds small padding before/after segment (more natural)
 * - fades in/out with gain automation (removes clicks)
 * - supports playback rate (slow mode)
 */
export async function playAudioSegment(
  url,
  startSec,
  endSec,
  {
    volume = null,      // ✅ NEW: 0..1 (preferred)
    gain = 1.0,         // legacy/advanced: 0..2
    rate = 1.0,
    padBefore = 0.03,
    padAfter = 0.05,
    fadeMs = 18,
  } = {}
) {

  if (!url) return;

  // stop whatever was playing
  if (typeof currentStop === "function") {
    try {
      currentStop();
    } catch {}
    currentStop = null;
  }

  const c = getCtx();
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {}
  }

  const buf = await loadBuffer(url);

  const safeRate = Math.max(0.5, Math.min(1.25, Number(rate) || 1));
  const rawS = Math.max(0, Number(startSec) || 0);
  const rawE = Math.max(rawS, Number(endSec) || 0);

  // If caller gives weird values, just do a tiny audible segment
  const baseDur = Math.max(0.05, rawE - rawS);

  // Apply padding but keep within buffer duration
  const paddedS = Math.max(0, rawS - (Number(padBefore) || 0));
  const paddedE = Math.min(buf.duration, rawE + (Number(padAfter) || 0));

  // If segment is too small or invalid, fallback to baseDur from rawS
  const segDur = Math.max(0.06, paddedE - paddedS || baseDur);

  const source = c.createBufferSource();
  source.buffer = buf;
  source.playbackRate.value = safeRate;

    const g = c.createGain();

  // ✅ If volume (0..1) is provided, prefer it. Otherwise use gain (0..2).
  const safeGain =
    volume != null
      ? Math.max(0, Math.min(1, Number(volume) || 0))
      : Math.max(0, Math.min(2, Number(gain) || 1));

  g.gain.value = 0; // start silent, fade in


  source.connect(g);
  g.connect(c.destination);

  const now = c.currentTime;
  const fade = Math.max(0.004, (Number(fadeMs) || 0) / 1000);

  // Fade in
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(safeGain, now + fade);

  // Fade out near end (slightly before end to guarantee it happens)
  const endAt = now + segDur / safeRate;
  const fadeOutAt = Math.max(now + fade, endAt - fade);

  g.gain.setValueAtTime(safeGain, fadeOutAt);
  g.gain.linearRampToValueAtTime(0, endAt);

  // Start and stop
  source.start(0, paddedS, segDur);

  // Hard stop a hair after fade ends (cleanup)
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setValueAtTime(0, c.currentTime);
    } catch {}
    try {
      source.stop();
    } catch {}
    try {
      source.disconnect();
      g.disconnect();
    } catch {}
  };

  // schedule cleanup
  const t = setTimeout(() => stop(), Math.ceil((segDur / safeRate) * 1000) + 50);

  // also cleanup on natural end
  source.onended = () => {
    clearTimeout(t);
    stop();
  };

  currentStop = stop;
  return stop;
}

/** Clear buffer cache if needed (optional) */
export function clearAudioBufferCache() {
  bufferCache.clear();
}
