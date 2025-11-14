import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export const LS_KEY = "ac_settings_v1";

export const defaultSettings = {
  // UI
  theme: "dark",                 // "dark" | "light"
  largeText: false,

  // Goals
  dailyGoal: 5,                  // default daily goal

  // Accent / IPA / TTS
  accentDefault: "en_us",        // "en_us" | "en_br"
  showIPA: true,
  showPhonemeTable: true,
  showStressTips: true,
  autoPlayNative: false,         // Imitate tab only
  ttsRate: 1.0,

  // Audio & Haptics (NEW)
  soundEnabled: true,            // enable short feedback sounds
  soundVolume: 0.6,              // 0–1
  hapticsEnabled: true,          // tiny vibration on success (mobile)

  // Privacy
  sendAudioToServer: true,
  keepRecordings: false,
  retentionDays: 7,
  shareDiagnostics: false,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw);
    return { ...defaultSettings, ...parsed };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

const Ctx = createContext({ settings: defaultSettings, setSettings: () => {} });

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings());

  // persist
  useEffect(() => { saveSettings(settings); }, [settings]);

  // apply theme class to <body>
  useEffect(() => {
    const b = document.body;
    b.classList.remove("theme-dark", "theme-light");
    b.classList.add(settings.theme === "light" ? "theme-light" : "theme-dark");
  }, [settings.theme]);

  const value = useMemo(() => ({ settings, setSettings }), [settings]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  return useContext(Ctx);
}
