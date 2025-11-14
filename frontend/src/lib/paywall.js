export function hasSeenPaywallOnce() {
  return localStorage.getItem("seenPaywall") === "1";
}
export function markPaywallSeen() {
  localStorage.setItem("seenPaywall", "1");
}
