// src/lib/conversationStorage.js

const LS_KEY = "fluentup_conversation_sessions_v1";

export function loadConversationSessions() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveConversationSession(session) {
  try {
    const all = loadConversationSessions();
    const next = [session, ...all].slice(0, 20);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}