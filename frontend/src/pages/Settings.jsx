import React, { useEffect, useState } from "react";
import { Volume2, Trash2, Send, Gift } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import { getReferralCode, getReferralCount, getProStatus } from "../lib/api.js";

const SHARE_BASE = (import.meta.env.VITE_SHARE_BASE || "https://accentcoach.ai").replace(/\/+$/, "");
const FEEDBACK_EMAIL = "jonas@fluentup.app";
const APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;

/* ---------- UI helpers ---------- */
function Row({ label, children, hint }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 py-3">
      <div className="sm:min-w-[200px]">
        <div className="font-medium" style={{ color: "var(--text)" }}>{label}</div>
        {hint && <div className="text-sm" style={{ color: "var(--muted)" }}>{hint}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div className="rounded-2xl panel">
      <div className="text-lg font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}

/* ---------- Main ---------- */
export default function Settings() {
  const { settings: s, setSettings: setS } = useSettings();
  const [fb, setFb] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbMsg, setFbMsg] = useState("");

  /* --- Referral + Pro --- */
  const [userId, setUserId] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  useEffect(() => {
    let id = localStorage.getItem("userId");
    if (!id) {
      id = "u_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("userId", id);
    }
    setUserId(id);

    async function loadReferral() {
      try {
        const codeRes = await getReferralCode(id);
        const countRes = await getReferralCount(id);
        const proRes = await getProStatus(id);
        setReferralCode(codeRes?.code || id);
        setReferralCount(countRes?.count || 0);
        setIsPro(proRes?.isPro || false);
      } catch (e) {
        console.warn("[Settings] Referral load failed:", e);
      }
    }
    loadReferral();
  }, []);

  const inviteUrl = referralCode
    ? `${APP_URL}/?ref=${encodeURIComponent(referralCode)}`
    : "";

  async function inviteFriend() {
    if (!inviteUrl) return;
    const text = "Join me on Accent Coach — I get 1 month free when you install with my link:";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Accent Coach", text, url: inviteUrl });
        return;
      } catch {}
    }
    window.open(inviteUrl, "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyMsg("Invite link opened and copied to clipboard.");
    } catch {
      setCopyMsg("Invite link opened. Copy it from the new tab.");
    }
    setTimeout(() => setCopyMsg(""), 2500);
  }

  /* --- Native test + feedback --- */
  const testNative = () => {
    const u = new SpeechSynthesisUtterance("This is a test.");
    u.rate = s.ttsRate;
    u.lang = s.accentDefault === "en_br" ? "en-GB" : "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const clearLocalData = () => {
    if (!confirm("This will reset your settings and locally cached clips (if any). Continue?")) return;
    try { localStorage.removeItem("ac_settings_v1"); location.reload(); } catch {}
  };

  async function sendFeedback() {
    const text = fb.trim();
    if (!text) return;
    setFbSending(true);
    setFbMsg("");
    try {
      const base = (import.meta.env.VITE_API_BASE || localStorage.getItem("apiBase") || window.location.origin).replace(/\/+$/, "");
      const r = await fetch(`${base}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, userAgent: navigator.userAgent, ts: Date.now() }),
      });
      if (!r.ok) throw new Error(await r.text());
      setFb("");
      setFbMsg("Thanks — sent!");
    } catch {
      const subject = encodeURIComponent("Accent Coach AI — Problem report");
      const body = encodeURIComponent(text + "\n\n—\nUA: " + navigator.userAgent);
      window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    } finally {
      setFbSending(false);
    }
  }

  /* ---------- Render ---------- */
  return (
    <div className="page">
      <div className="settings-page mx-auto">
        <h1 className="text-[24px] sm:text-[26px] font-extrabold tracking-tight mb-4">
          <a href="/settings" className="page-title">Settings</a>
        </h1>

        <div className="grid gap-4">
          {/* --- Pro & Referral --- */}
          <Section title="Pro & Referral">
            <Row label="Your status">
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                {isPro ? "✅ You have Pro access" : "Free plan"}
              </div>
            </Row>

            <Row label="Invites sent">
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                {referralCount} friend{referralCount === 1 ? "" : "s"} joined
              </div>
            </Row>

            <Row
              label="Invite a friend"
              hint="When a friend installs the app using your link, YOU get 1 month free."
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={inviteFriend}
                  type="button"
                  className="btn btn-primary whitespace-nowrap"
                >
                  <Gift className="h-4 w-4" /> Invite a friend
                </button>
                {copyMsg && <div className="text-sm" style={{ color: "var(--muted)" }}>{copyMsg}</div>}
              </div>
              {inviteUrl && (
                <div className="mt-2 text-xs break-all" style={{ color: "var(--muted)" }}>
                  {inviteUrl}
                </div>
              )}
            </Row>
          </Section>

          {/* Speaking & Playback */}
          <Section title="Speaking & Playback">
            <Row label="Default accent" hint="Used for IPA, target, and native TTS language.">
              <div className="relative inline-block">
                <select
                  className="bg-white/10 border border-white/10 rounded-xl px-3 py-[10px] pr-9 text-sm focus:outline-none"
                  value={s.accentDefault}
                  onChange={(e) => setS({ ...s, accentDefault: e.target.value })}
                >
                  <option value="en_us">🇺🇸 American English (US)</option>
                  <option value="en_br">🇬🇧 British English (UK)</option>
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/60">▾</span>
              </div>
            </Row>

            <Row label="TTS speed">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="range" min="0.5" max="1.5" step="0.05"
                  value={s.ttsRate}
                  onChange={(e) => setS({ ...s, ttsRate: Number(e.target.value) })}
                  className="w-56"
                />
                <span className="w-14 text-right">{s.ttsRate.toFixed(2)}×</span>
                <button onClick={testNative} className="btn btn-ghost btn-sm">
                  <Volume2 className="h-4 w-4" /> Test
                </button>
              </div>
            </Row>

            <Row label="Auto-play native (Imitate tab only)">
              <label className="inline-flex items-center gap-2 select-none">
                <input type="checkbox" checked={s.autoPlayNative} onChange={(e) => setS({ ...s, autoPlayNative: e.target.checked })} />
                <span className="text-sm" style={{ color: "var(--muted)" }}>Play the native voice automatically in Imitate</span>
              </label>
            </Row>
          </Section>

          {/* Progress (NEW) */}
          <Section title="Progress">
            <Row
              label="Daily goal"
              hint="How many completed analyses you want per day."
            >
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="20"
                  className="w-24 bg-white/10 border border-white/10 rounded-xl px-3 py-[10px] text-sm"
                  value={s.dailyGoal ?? 5}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(20, Number(e.target.value || 5)));
                    setS({ ...s, dailyGoal: v });
                  }}
                />
                <span className="text-sm" style={{ color: "var(--muted)" }}>goals/day</span>
              </div>
            </Row>
          </Section>

          {/* Feedback display */}
          <Section title="Feedback display">
            <Row label="Show IPA">
              <input type="checkbox" checked={s.showIPA} onChange={(e) => setS({ ...s, showIPA: e.target.checked })} />
            </Row>
            <Row label="Show phoneme table">
              <input type="checkbox" checked={s.showPhonemeTable} onChange={(e) => setS({ ...s, showPhonemeTable: e.target.checked })} />
            </Row>
            <Row label="Word stress tips">
              <input type="checkbox" checked={s.showStressTips} onChange={(e) => setS({ ...s, showStressTips: e.target.checked })} />
            </Row>
            <Row label="Large text">
              <input type="checkbox" checked={s.largeText} onChange={(e) => setS({ ...s, largeText: e.target.checked })} />
            </Row>
          </Section>

          {/* Interface */}
          <Section title="Interface">
            <Row label="Theme">
              <div className="relative inline-block">
                <select
                  className="bg-white/10 border border-white/10 rounded-xl px-3 py-[10px] pr-9 text-sm focus:outline-none"
                  value={s.theme}
                  onChange={(e) => setS({ ...s, theme: e.target.value })}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/60">▾</span>
              </div>
            </Row>
          </Section>

{/* Audio & Haptics */}
<Section title="Audio & Haptics">
  <Row label="Feedback sounds" hint="Short chimes on success, soft cues on errors.">
    <label className="inline-flex items-center gap-2 select-none">
      <input
        type="checkbox"
        checked={s.soundEnabled}
        onChange={(e) => setS({ ...s, soundEnabled: e.target.checked })}
      />
      <span className="text-sm" style={{ color: 'var(--muted)' }}>Enable sounds</span>
    </label>
  </Row>

  <Row label="Volume">
    <div className="flex items-center gap-3">
      <input
        type="range" min="0" max="1" step="0.01"
        value={s.soundVolume}
        onChange={(e) => setS({ ...s, soundVolume: Number(e.target.value) })}
        className="w-56"
      />
      <span className="w-12 text-right">{Math.round(s.soundVolume * 100)}%</span>
    </div>
  </Row>

  <Row label="Haptics (mobile)">
    <label className="inline-flex items-center gap-2 select-none">
      <input
        type="checkbox"
        checked={s.hapticsEnabled}
        onChange={(e) => setS({ ...s, hapticsEnabled: e.target.checked })}
      />
      <span className="text-sm" style={{ color: 'var(--muted)' }}>Tiny vibrations on success</span>
    </label>
  </Row>
</Section>


          {/* Privacy & data */}
          <Section title="Privacy & data">
            <Row
              label="Send audio to server"
              hint="Needed for cloud scoring. Turn off to keep audio on this device (some features will be disabled)."
            >
              <input
                type="checkbox"
                checked={s.sendAudioToServer}
                onChange={(e) => setS({ ...s, sendAudioToServer: e.target.checked })}
              />
            </Row>

            <Row label="Keep recordings locally" hint="Store clips in this browser so you can replay them. Nothing is uploaded.">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="checkbox"
                  checked={s.keepRecordings}
                  onChange={(e) => setS({ ...s, keepRecordings: e.target.checked })}
                />
                <span className="text-sm" style={{ color: "var(--muted)" }}>Retention</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  className="w-20 bg-white/10 border border-white/10 rounded-xl px-2 py-[10px]"
                  value={s.retentionDays}
                  onChange={(e) => setS({ ...s, retentionDays: Number(e.target.value) })}
                />
                <span className="text-sm" style={{ color: "var(--muted)" }}>days</span>
              </div>
            </Row>

            <div className="mt-3">
              <button
                onClick={clearLocalData}
                className="btn btn-ghost text-red-200"
                style={{ borderColor: "rgba(239,68,68,.35)" }}
              >
                <Trash2 className="h-4 w-4" /> Clear cached data
              </button>
            </div>
          </Section>

          {/* Report a problem */}
          <Section title="Report a problem">
            <Row label="Tell us what went wrong" hint="Include what you tried and what you expected to happen.">
              <div className="grid gap-2">
                <textarea
                  value={fb}
                  onChange={(e) => setFb(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl bg-white/10 border border-white/10 p-3 outline-none"
                  placeholder="Describe the issue…"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={sendFeedback}
                    disabled={!fb.trim() || fbSending}
                    className="btn btn-primary disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" /> {fbSending ? "Sending…" : "Send feedback"}
                  </button>
                  {fbMsg && <div className="text-sm" style={{ color: "var(--muted)" }}>{fbMsg}</div>}
                </div>
              </div>
            </Row>
          </Section>
        </div>
      </div>
    </div>
  );
}