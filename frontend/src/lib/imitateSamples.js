// Very small starter set — expand whenever you like.
export const IMITATE_SAMPLES = {
  easy: [
    { id: "e1", text: "How are you?", voice: "en-US" },
    { id: "e2", text: "Nice to meet you.", voice: "en-GB" },
  ],
  medium: [
    { id: "m1", text: "I can't believe it's already Friday.", voice: "en-US" },
    { id: "m2", text: "Could you pass me the water, please?", voice: "en-GB" },
  ],
  hard: [
    { id: "h1", text: "The weather’s unpredictable this time of year.", voice: "en-US" },
    { id: "h2", text: "She thoroughly thought through the theory.", voice: "en-GB" },
  ],
};

export function pickSample(level = "easy") {
  const arr = IMITATE_SAMPLES[level] || IMITATE_SAMPLES.easy;
  return arr[Math.floor(Math.random() * arr.length)];
}
