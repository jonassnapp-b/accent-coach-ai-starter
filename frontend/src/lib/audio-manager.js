// src/lib/audio-manager.js
let currentAudio = null;

export function playAudio(src, { volume = 1.0 } = {}) {
  stopAudio();
  const a = new Audio();
  a.src = src;
  a.volume = volume;
  a.play().catch(() => {});
  currentAudio = a;
  return a;
}

export function stopAudio() {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
      currentAudio.load?.();
    }
  } catch {}
  currentAudio = null;
}

export function getCurrentAudio() {
  return currentAudio;
}
