// frontend/src/lib/api.js
export const API_BASE =
  (import.meta.env.VITE_API_BASE || window.location.origin).replace(/\/+$/, "");

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  feedback: (phrase) =>
    jsonFetch(`${API_BASE}/api/feedback?phrase=${encodeURIComponent(phrase)}`),

  attempt: (payload) =>
    jsonFetch(`${API_BASE}/api/attempt`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  progress: (userId) =>
    jsonFetch(`${API_BASE}/api/progress?userId=${encodeURIComponent(userId)}`),

  leaderboard: () => jsonFetch(`${API_BASE}/api/leaderboard`),

  share: (payload) =>
    jsonFetch(`${API_BASE}/api/share`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  chat: (messages) =>
    jsonFetch(`${API_BASE}/api/chat`, {
      method: "POST",
      body: JSON.stringify({ messages }),
    }),

  sentences: (level = "easy") =>
    jsonFetch(`${API_BASE}/api/sentences?level=${encodeURIComponent(level)}`),
};
