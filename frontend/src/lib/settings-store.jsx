// src/lib/settings-store.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export const LS_KEY = "ac_settings_v1";

export const defaultSettings = {
  // UI
  theme: "light", // "dark" | "light"  ✅ default should match app
  largeText: false,

  // Goals
  dailyGoal: 5,

  // Accent / IPA / TTS
  accentDefault: "en_us", // "en_us" | "en_br"
  showIPA: true,
  showPhonemeTable: true,
  showStressTips: true,
  autoPlayNative: false, // Imitate tab only
  ttsRate: 1.0,
  // Difficulty (SpeechSuper slack)
  slack: 0, // -1..1 (0 = recommended)

  // Audio
  volume: 0.6, // 0–1 (GLOBAL volume used across the app)

  // Legacy (keep for migration/backwards compat)
  soundEnabled: true,
  soundVolume: 0.6, // 0–1 (old)
  hapticsEnabled: true,


  // Privacy
  sendAudioToServer: true,
  keepRecordings: false,
  retentionDays: 7,

  // Optional diagnostics
  shareDiagnostics: false,
};

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function coerceSettings(maybe) {
  // Merge + basic type safety so broken LS doesn't poison the app.
  const s = { ...defaultSettings, ...(maybe && typeof maybe === "object" ? maybe : {}) };

  // Coerce types
  s.theme = s.theme === "dark" ? "dark" : "light";
  s.largeText = !!s.largeText;

  s.dailyGoal = Number.isFinite(Number(s.dailyGoal)) ? Math.max(1, Math.min(20, Number(s.dailyGoal))) : defaultSettings.dailyGoal;

  s.accentDefault = s.accentDefault === "en_br" ? "en_br" : "en_us";
  s.showIPA = !!s.showIPA;
  s.showPhonemeTable = !!s.showPhonemeTable;
  s.showStressTips = !!s.showStressTips;
  s.autoPlayNative = !!s.autoPlayNative;
  const slack = Number(s.slack);
  s.slack = Number.isFinite(slack) ? Math.max(-1, Math.min(1, slack)) : defaultSettings.slack;

  const rate = Number(s.ttsRate);
  s.ttsRate = Number.isFinite(rate) ? Math.max(0.5, Math.min(1.5, rate)) : defaultSettings.ttsRate;

  // --- GLOBAL volume (new) ---
  // Migration: if volume is missing but old soundVolume exists, use it.
  if (s.volume == null && s.soundVolume != null) s.volume = s.soundVolume;

  const v = Number(s.volume);
  s.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : defaultSettings.volume;

  // --- Legacy aliases (read-only compatibility) ---
  // Keep old keys in the object so older code won't crash,
  // but DO NOT treat them as independent settings anymore.
  s.soundEnabled = s.volume > 0.001;
  s.soundVolume = s.volume;
  s.hapticsEnabled = false;



  s.sendAudioToServer = !!s.sendAudioToServer;
  s.keepRecordings = !!s.keepRecordings;
  const rd = Number(s.retentionDays);
  s.retentionDays = Number.isFinite(rd) ? Math.max(1, Math.min(30, rd)) : defaultSettings.retentionDays;

  s.shareDiagnostics = !!s.shareDiagnostics;

  return s;
}

function loadSettings() {
  if (typeof localStorage === "undefined") return { ...defaultSettings };
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return { ...defaultSettings };
  return coerceSettings(safeParse(raw));
}

function saveSettings(s) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

const Ctx = createContext({
  settings: defaultSettings,
  setSettings: () => {},
  resetSettings: () => {},
});

export function SettingsProvider({ children }) {
  const [settings, _setSettings] = useState(loadSettings);

  // React-style setSettings: accepts object OR updater fn
  const setSettings = (next) => {
    _setSettings((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      return coerceSettings(resolved);
    });
  };

  const resetSettings = () => {
    _setSettings({ ...defaultSettings });
  };

  // persist
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // apply theme globally (this is the part that makes the Theme dropdown real)
  useEffect(() => {
    const theme = settings.theme === "dark" ? "dark" : "light";

    // Apply to <html> for CSS variables / global selectors
    document.documentElement.dataset.theme = theme;

    // Also add classes for legacy CSS
    const b = document.body;
    b.classList.remove("theme-dark", "theme-light");
    b.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
  }, [settings.theme]);

  const value = useMemo(() => ({ settings, setSettings, resetSettings }), [settings]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  return useContext(Ctx);
}
