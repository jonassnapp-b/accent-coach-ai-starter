// src/pages/Settings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Trash2, Send, Gift } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";
import { getReferralCode, getReferralCount, getProStatus } from "../lib/api.js";

const FEEDBACK_EMAIL = "jonas@fluentup.app";
const APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;

/* ---------- UI helpers ---------- */
function Row({ label, children, hint }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 py-3">
      <div className="sm:min-w-[220px]">
        <div className="font-medium" style={{ color: "var(--text)" }}>
          {label}
        </div>
        {hint ? (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            {hint}
          </div>
        ) : null}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl panel">
      <div className="text-lg font-semibold mb-3" style={{ color: "var(--text)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ControlSelect(props) {
  return (
    <select
      {...props}
      className={[
        "rounded-xl px-3 py-[10px] pr-9 text-sm outline-none",
        "border",
        "focus:ring-2 focus:ring-[rgba(33,150,243,.35)]",
        props.className || "",
      ].join(" ")}
      style={{
        background: "var(--panel-bg)",
        color: "var(--panel-text)",
        borderColor: "var(--panel-border)",
      }}
    />
  );
}

function ControlInput(props) {
  return (
    <input
      {...props}
      className={[
        "rounded-xl px-3 py-[10px] text-sm outline-none",
        "border",
        "focus:ring-2 focus:ring-[rgba(33,150,243,.35)]",
        props.className || "",
      ].join(" ")}
      style={{
        background: "var(--panel-bg)",
        color: "var(--panel-text)",
        borderColor: "var(--panel-border)",
      }}
    />
  );
}

/* ---------- Main ---------- */
export default function Settings() {
  const { settings: s, setSettings: setS } = useSettings();

  // local feedback state
  const [fb, setFb] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbMsg, setFbMsg] = useState("");

  /* --- Referral + Pro --- */
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

    async function loadReferral() {
      try {
        const codeRes = await getReferralCode(id);
        const countRes = await getReferralCount(id);
        const proRes = await getProStatus(id);
        setReferralCode(codeRes?.code || id);
        setReferralCount(countRes?.count || 0);
        setIsPro(!!proRes?.isPro);
      } catch (e) {
        console.warn("[Settings] Referral load failed:", e);
      }
    }
    loadReferral();
  }, []);

  const inviteUrl = useMemo(() => {
    return referralCode ? `${APP_URL}/?ref=${encodeURIComponent(referralCode)}` : "";
  }, [referralCode]);

  async function inviteFriend() {
    if (!inviteUrl) return;
    const text = "Join me on Accent Coach — I get 1 month free when you install with my link:";

    if (navigator.share) {
      try {
        await navigator.share({ title: "Accent Coach", text, url: inviteUrl });
        return;
      } catch {
        // fall through
      }
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

  const clearLocalData = () => {
    if (!confirm("This will reset your settings and locally cached clips (if any). Continue?")) return;
    try {
      localStorage.removeItem("ac_settings_v1");
      location.reload();
    } catch {
      // ignore
    }
  };

  async function sendFeedback() {
    const text = fb.trim();
    if (!text) return;

    setFbSending(true);
    setFbMsg("");

    try {
      const base = (import.meta.env.VITE_API_BASE || localStorage.getItem("apiBase") || window.location.origin).replace(
        /\/+$/,
        ""
      );
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

  const volumeVal = useMemo(() => {
    const v = Number(s.volume);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  }, [s.volume]);

  /* ---------- Render ---------- */
  return (
    <div className="page">
      <div className="mx-auto max-w-[1100px]">
        <div style={{ padding: "14px 16px 8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
            <div />
            <div style={{ textAlign: "center", fontWeight: 900, fontSize: 18, color: "var(--text)" }}>Settings</div>
            <div />
          </div>
        </div>

        <div className="h-2" />

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

            <Row label="Invite a friend" hint="When a friend installs the app using your link, YOU get 1 month free.">
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={inviteFriend} type="button" className="btn btn-primary whitespace-nowrap">
                  <Gift className="h-4 w-4" /> Invite a friend
                </button>
                {copyMsg ? (
                  <div className="text-sm" style={{ color: "var(--muted)" }}>
                    {copyMsg}
                  </div>
                ) : null}
              </div>

              {inviteUrl ? (
                <div className="mt-2 text-xs break-all" style={{ color: "var(--muted)" }}>
                  {inviteUrl}
                </div>
              ) : null}
            </Row>
          </Section>

          {/* Speaking */}
          <Section title="Speaking">
            <Row label="Default accent" hint="Used for IPA, target, and native TTS language.">
              <div className="inline-flex items-center gap-2">
                <ControlSelect value={s.accentDefault} onChange={(e) => setS({ ...s, accentDefault: e.target.value })}>
                  <option value="en_us">🇺🇸 American English (US)</option>
                  <option value="en_br">🇬🇧 British English (UK)</option>
                </ControlSelect>
              </div>
            </Row>
          </Section>

          {/* Audio */}
          <Section title="Audio">
            <Row label="Volume">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volumeVal}
                  onChange={(e) => setS({ ...s, volume: Number(e.target.value) })}
                  className="w-56"
                />
                <span className="w-12 text-right" style={{ color: "var(--muted)" }}>
                  {Math.round(volumeVal * 100)}%
                </span>
              </div>
            </Row>
          </Section>

          {/* Privacy & data (unchanged) */}
          <Section title="Privacy & data">
            <Row
              label="Send audio to server"
              hint="Needed for cloud scoring. Turn off to keep audio on this device (some features will be disabled)."
            >
              <input
                type="checkbox"
                checked={!!s.sendAudioToServer}
                onChange={(e) => setS({ ...s, sendAudioToServer: e.target.checked })}
              />
            </Row>

            <Row label="Keep recordings locally" hint="Store clips in this browser so you can replay them. Nothing is uploaded.">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="checkbox"
                  checked={!!s.keepRecordings}
                  onChange={(e) => setS({ ...s, keepRecordings: e.target.checked })}
                />
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  Retention
                </span>
                <ControlInput
                  type="number"
                  min="1"
                  max="30"
                  value={s.retentionDays ?? 7}
                  onChange={(e) => setS({ ...s, retentionDays: Number(e.target.value) })}
                  className="w-20"
                />
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  days
                </span>
              </div>
            </Row>

            <div className="mt-3">
              <button
                onClick={clearLocalData}
                className="btn btn-ghost text-red-600"
                style={{ borderColor: "rgba(239,68,68,.35)" }}
              >
                <Trash2 className="h-4 w-4" /> Clear cached data
              </button>
            </div>
          </Section>

          {/* Report a problem (unchanged) */}
          <Section title="Report a problem">
            <Row label="Tell us what went wrong" hint="Include what you tried and what you expected to happen.">
              <div className="grid gap-2">
                <textarea
                  value={fb}
                  onChange={(e) => setFb(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl p-3 outline-none focus:ring-2 focus:ring-[rgba(33,150,243,.35)]"
                  style={{
                    background: "var(--panel-bg)",
                    color: "var(--panel-text)",
                    border: "1px solid var(--panel-border)",
                  }}
                  placeholder="Describe the issue…"
                />

                <div className="flex items-center gap-2">
                  <button onClick={sendFeedback} disabled={!fb.trim() || fbSending} className="btn btn-primary disabled:opacity-60">
                    <Send className="h-4 w-4" /> {fbSending ? "Sending…" : "Send feedback"}
                  </button>
                  {fbMsg ? (
                    <div className="text-sm" style={{ color: "var(--muted)" }}>
                      {fbMsg}
                    </div>
                  ) : null}
                </div>
              </div>
            </Row>
          </Section>
        </div>
      </div>
    </div>
  );
}
