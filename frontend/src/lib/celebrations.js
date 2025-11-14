import confetti from "canvas-confetti";

export function burstConfetti() {
  try {
    const count = 130;
    const defaults = { zIndex: 9999, spread: 55, startVelocity: 42, ticks: 200 };
    confetti({ ...defaults, particleCount: Math.floor(count * 0.35), angle: 60, origin: { x: 0, y: 0.9 } });
    confetti({ ...defaults, particleCount: Math.floor(count * 0.65), angle: 120, origin: { x: 1, y: 0.9 } });
  } catch {}
}
